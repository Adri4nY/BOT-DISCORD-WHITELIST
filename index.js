require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes,
  MessageFlags
} = require('discord.js');
const fs = require('fs');
const express = require('express');

// ------------------- Servidor web ------------------- //
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("✅ Bot activo y funcionando!"));
app.listen(PORT, () => console.log(`🌐 Servidor web activo en puerto ${PORT}`));

// ------------------- Config ------------------- //
const preguntas = JSON.parse(fs.readFileSync("preguntas.json", "utf8"));
const LOG_CHANNEL_ID = "1422893357042110546";
const LOG_CHANNEL_TRANSCRIPTS_ID = "1294340206337462415";
const PUBLIC_CHANNEL_ID = "1422893357042110546";
const RESET_LOG_CHANNEL_ID = "1424694967472754769";
const LOGS_CHANNEL_ID = "1425162413690327040";
const WHITELIST_CATEGORY_ID = "1422897937427464203";
const SOPORTE_CATEGORY_ID = "1422898157829881926";
const COOLDOWN_HORAS = 6;
const ROLES = {
  whitelist: "822529294365360139",
  sinWhitelist: "1320037024358600734",
};
const MOD_ROLES = {
  moderador: "1226606346967973900",
  soporte: "1226606408682700862",
  admin: "1203773772868620308"
};
const cooldowns = new Map();

// ------------------- Cliente Discord ------------------- //
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// ------------------- Verificar token ------------------- //
if (!process.env.TOKEN) {
  console.error("❌ ERROR: La variable TOKEN no está definida.");
  process.exit(1);
} else {
  console.log("🔑 TOKEN cargado correctamente.");
}

// ------------------- Función hacer pregunta ------------------- //
async function hacerPregunta(channel, usuario, pregunta, index, total) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("a").setLabel("A").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("b").setLabel("B").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("c").setLabel("C").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("d").setLabel("D").setStyle(ButtonStyle.Secondary)
  );

  const opciones = pregunta.opciones
    .map((texto, i) => `${String.fromCharCode(65 + i)}) ${texto}`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`❓ Pregunta ${index + 1} de ${total}`)
    .setDescription(`**${pregunta.pregunta}**\n\n${opciones}`)
    .setColor("Purple");

  const msg = await channel.send({ embeds: [embed], components: [row] });

  return new Promise((resolve) => {
    const filter = (i) => i.user.id === usuario.id;
    msg.awaitMessageComponent({ filter, time: 60000 })
      .then(async (interaction) => {
        await interaction.deferUpdate().catch(() => {});
        await msg.delete().catch(() => {});
        resolve(interaction.customId);
      })
      .catch(() => {
        msg.delete().catch(() => {});
        channel.send("⏰ Tiempo agotado, pasamos a la siguiente.").catch(() => {});
        resolve(null);
      });
  });
}

// ------------------- Evento Ready ------------------- //
client.on("ready", async () => {
  console.log(`✅ Bot iniciado como: ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "UNITY CITY 🎮", type: 0 }],
    status: "online",
  });

  // Registrar comandos
  const commands = [
    new SlashCommandBuilder().setName("setup-soporte").setDescription("Configura el sistema de soporte."),
    new SlashCommandBuilder()
      .setName("reset-whitelist")
      .setDescription("Resetea la whitelist de un usuario.")
      .addUserOption(opt => opt.setName("usuario").setDescription("Usuario a resetear").setRequired(true)),
    new SlashCommandBuilder()
      .setName("donaciones")
      .setDescription("Muestra información sobre las donaciones."),
    new SlashCommandBuilder().setName("pilegales").setDescription("Muestra pautas legales."),
    new SlashCommandBuilder().setName("pnegocios").setDescription("Muestra pautas de negocios."),
    new SlashCommandBuilder().setName("pstaff").setDescription("Muestra pautas de staff."),
    new SlashCommandBuilder().setName("pck").setDescription("Muestra pautas de CK."),
    new SlashCommandBuilder().setName("pstreamer").setDescription("Muestra pautas de streamers."),
    new SlashCommandBuilder()
      .setName("addwhitelist")
      .setDescription("Añade un usuario a la whitelist.")
      .addUserOption(opt => opt.setName("usuario").setDescription("Usuario a añadir").setRequired(true))
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  const GUILD_ID = "821091789325729803";
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
  console.log("✅ Comandos registrados correctamente.");
});

// ------------------- Interacciones ------------------- //
client.on("interactionCreate", async (interaction) => {
  try {
    const guild = interaction.guild;
    if (!guild) return;

    // ------------------- /reset-whitelist ------------------- //
    if (interaction.isChatInputCommand() && interaction.commandName === "reset-whitelist") {
      await interaction.deferReply({ ephemeral: true });
      const usuario = interaction.options.getUser("usuario");
      const miembro = await guild.members.fetch(usuario.id).catch(() => null);

      if (!miembro) {
        return interaction.editReply({ content: "⚠️ No se pudo encontrar al usuario en el servidor." });
      }

      try {
        await miembro.roles.remove(ROLES.whitelist).catch(() => {});
        await miembro.roles.add(ROLES.sinWhitelist).catch(() => {});
      } catch (err) {
        console.error(err);
        return interaction.editReply({ content: "❌ Error al modificar los roles del usuario." });
      }

      const embed = new EmbedBuilder()
        .setTitle("🔁 Whitelist Reseteada")
        .setDescription(`El usuario ${usuario} ha sido reseteado correctamente de la whitelist.`)
        .setColor("Orange")
        .setTimestamp();

      const logChannel = guild.channels.cache.get(RESET_LOG_CHANNEL_ID);
      if (logChannel) logChannel.send({ embeds: [embed] }).catch(() => {});

      await interaction.editReply({ content: "✅ Whitelist reseteada correctamente." });
      return;
    }

    // ------------------- /donaciones ------------------- //
    if (interaction.isChatInputCommand() && interaction.commandName === "donaciones") {
      const embed = new EmbedBuilder()
        .setTitle("💸 Donaciones - UNITY CITY")
        .setDescription(
          "¡Gracias por querer apoyar el servidor! ❤️\n\n" +
          "Puedes colaborar mediante donaciones para mantener el servidor activo y mejorar la experiencia de juego.\n\n" +
          "**Métodos disponibles:**\n" +
          "• 💳 PayPal\n" +
          
          "📩 Para poder realizar la donacion, deberas de enviar la cantidad por **AMIGOS Y FAMILIARES**."
        )
        .setColor("Purple")
        .setFooter({ text: "UNITY CITY RP - Donaciones", iconURL: guild.iconURL() })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // ------------------- Comando /addwhitelist ------------------- //
if (interaction.isChatInputCommand() && interaction.commandName === "addwhitelist") {
  const member = await guild.members.fetch(interaction.user.id);
  const allowedRoles = [MOD_ROLES.admin, MOD_ROLES.moderador, MOD_ROLES.soporte];

  if (!allowedRoles.some(role => member.roles.cache.has(role))) {
    return interaction.reply({
      content: "❌ No tienes permiso para usar este comando. Solo Staff puede hacerlo.",
      flags: MessageFlags.Ephemeral
    });
  }

  const usuario = interaction.options.getUser("usuario");
  const miembro = await guild.members.fetch(usuario.id);

  await miembro.roles.add(ROLES.whitelist).catch(() => {});
  await miembro.roles.remove(ROLES.sinWhitelist).catch(() => {});

  // Canal público
  const publicChannel = guild.channels.cache.get(PUBLIC_CHANNEL_ID); 
  if (publicChannel) {
    const embed = new EmbedBuilder()
      .setTitle("✅ Whitelist Añadida")
      .setDescription(`➡️ El usuario ${usuario} ha sido añadido a la whitelist.`)
      .setColor("Green")
      .setTimestamp();

    publicChannel.send({ embeds: [embed] });
  }

  // Mensaje efímero al que ejecutó el comando
  await interaction.reply({ content: "✅ Usuario añadido a la whitelist correctamente.", ephemeral: true });

  // Log de staff
  const logChannel = guild.channels.cache.get(LOGS_CHANNEL_ID);
  if (logChannel) {
    const logEmbed = new EmbedBuilder()
      .setTitle("📋 Nuevo añadido a Whitelist")
      .setDescription(`👤 **Usuario añadido:** ${usuario}\n🧑‍💼 **Añadido por:** ${interaction.user}`)
      .setColor("Purple")
      .setTimestamp();

    logChannel.send({ embeds: [logEmbed] });
  }
  return;
}

    // ------------------- Comandos de pautas ------------------- //
    if (interaction.isChatInputCommand() && ["pstaff", "pilegales", "pnegocios", "pck", "pstreamer"].includes(interaction.commandName)) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});

      const commandName = interaction.commandName;
      const member = await guild.members.fetch(interaction.user.id);
      const allowedRoles = [MOD_ROLES.admin, MOD_ROLES.moderador, MOD_ROLES.soporte];

      if (!allowedRoles.some(role => member.roles.cache.has(role))) {
        return interaction.editReply({
          content: "❌ No tienes permiso para usar este comando. Solo Staff puede usarlo."
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`📌 Pautas para ${commandName.replace("p", "").toUpperCase()}`)
        .setColor("Purple")
        .setFooter({ text: "UNITY CITY RP - Postulación" })
        .setTimestamp();

      switch (commandName) {
        case "pilegales":
          embed.addFields(
            { name: "📝 Formato", value: "PDF OBLIGATORIO", inline: false },
            { name: "🏴 Origen de la banda", value: "Describe el origen de la banda.", inline: false },
            { name: "📜 Historia y expansión", value: "Explica la historia y expansión de la banda.", inline: false },
            { name: "⚔️ Estructura y símbolos", value: "Detalla la estructura y símbolos que representen la banda.", inline: false },
            { name: "💎 Personalidad y reputación", value: "Describe la personalidad y reputación.", inline: false },
            { name: "🎯 Aportación al servidor", value: "Qué vais a aportar y cómo fomentaréis el rol.", inline: false },
            { name: "⏰ Disponibilidad", value: "Disponibilidad horaria de los miembros y planes de progresión.", inline: false },
            { name: "📍 Ubicación", value: "Foto de la ubicación del barrio.", inline: false },
            { name: "👥 Integrantes", value: "Lista de integrantes.", inline: false },
            { name: "🎨 Grafiti", value: "Boceto o foto del grafiti.", inline: false }
          );
          break;
        case "pnegocios":
          embed.addFields(
            { name: "🏪 Nombre del local", value: "Motivo por el que quieres postular a ese negocio", inline: false },
            { name: "👥 Empleados", value: "Lista de empleados", inline: false },
            { name: "📜 Normativa del local", value: "Reglas y normas internas", inline: false },
            { name: "💡 Ideas para el negocio", value: "Ideas creativas para el negocio", inline: false },
            { name: "🎉 Eventos planeados", value: "Eventos que tienes pensados para realizar", inline: false },
            { name: "✨ Consejo", value: "Recordar ser creativos y tener buenas ideas! SUERTE!!", inline: false }
          );
          break;
        case "pstaff":
          embed.addFields(
            { name: "🧑‍💼 Nombre OOC", value: "Tu nombre fuera del rol", inline: false },
            { name: "🎂 Edad OOC", value: "Tu edad real", inline: false },
            { name: "⏳ Tiempo en el servidor", value: "¿Cuánto tiempo llevas en el servidor?", inline: false },
            { name: "⚠️ Sanciones administrativas", value: "¿Tienes alguna sanción grave?", inline: false },
            { name: "💪 Cualidades y puntos fuertes", value: "Describe tus fortalezas", inline: false },
            { name: "❌ Defectos y puntos débiles", value: "Describe tus debilidades", inline: false },
            { name: "⏰ Disponibilidad horaria", value: "Horario en el que puedes estar activo", inline: false },
            { name: "🎮 URL de Steam", value: "Link a tu cuenta de Steam", inline: false }
          );
          break;
        case "pck":
          embed.addFields(
            { name: "🆔 Nombre IC", value: "Tu nombre dentro del rol", inline: false },
            { name: "💀 Motivos para hacer CK", value: "Explica por qué deseas realizar CK", inline: false },
            { name: "🎭 Rol posterior", value: "Rol que vas a desempeñar después de la muerte de este", inline: false },
            { name: "💡 Otros detalles", value: "Cualquier otra información que quieras agregar sobre tu CK", inline: false }
          );
          break;
        case "pstreamer":
          embed.addFields(
            { name: "🧑‍💻 Nombre OOC", value: "Tu nombre fuera del rol", inline: false },
            { name: "🎂 Edad OOC", value: "Tu edad real", inline: false },
            { name: "⏱️ Horas roleadas en FiveM", value: "Cantidad de horas roleadas", inline: false },
            { name: "⏳ Tiempo en el servidor", value: "¿Cuánto tiempo llevas en el servidor?", inline: false },
            { name: "🎮 URL de Steam", value: "Link a tu cuenta de Steam", inline: false },
            { name: "📺 Link de la red social", value: "Red social donde vas a streamear el servidor", inline: false }
          );
          break;
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // ------------------- Setup Soporte ------------------- //
    if (interaction.isChatInputCommand() && interaction.commandName === "setup-soporte") {
      const embed = new EmbedBuilder()
        .setTitle("🎫 Sistema de Tickets - UNITY CITY")
        .setDescription("Selecciona el tipo de ticket que quieras abrir 👇")
        .setColor("Purple");

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("ticket_select")
          .setPlaceholder("Abrir un ticket...")
          .addOptions([
            { label: "Soporte General", value: "soporte_general", description: "Abrir ticket de soporte general", emoji: "🟢" },
            { label: "Reportes", value: "reportes", description: "Abrir ticket de reportes", emoji: "🐞" },
            { label: "CK", value: "ck", description: "Abrir ticket de CK", emoji: "💀" },
            { label: "Donaciones", value: "donaciones", description: "Abrir ticket de donaciones", emoji: "💸" },
            { label: "Facciones", value: "facciones", description: "Abrir ticket de facciones", emoji: "🏢" },
            { label: "Postulación", value: "postulacion", description: "Abrir ticket de postulación", emoji: "📋" },
          ])
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }


// ------------------- Ticket Select ------------------- //
if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
  // Prevenir doble ejecución
  if (interaction.ticketProcessing) return;
  interaction.ticketProcessing = true;

  const ticketMap = {
    soporte_general: { cat: SOPORTE_CATEGORY_ID, label: "🟢 Ticket de Soporte General" },
    reportes: { cat: "1423746566610620568", label: "🐞 Ticket de Reportes" },
    ck: { cat: "1423746747741765632", label: "💀 Ticket de CK" },
    donaciones: { cat: "1423747380637073489", label: "💸 Ticket de Donaciones" },
    facciones: { cat: "1423747506382311485", label: "🏢 Ticket de Facciones" },
    postulacion: { cat: "1423747604495466536", label: "📋 Ticket de Postulación" }
  };

  const tipo = interaction.values[0];
  const { cat, label } = ticketMap[tipo];
  const encargadoDonaciones = "1281934868410007653"; 

  // ✅ Prevenir tickets duplicados
  const existingTicket = guild.channels.cache.find(
    c => c.name.startsWith(`${tipo}-${interaction.user.username}`)
  );

  if (existingTicket) {
    interaction.ticketProcessing = false;
    return interaction.reply({
      content: `⚠️ Ya tienes un ticket abierto: ${existingTicket}`,
      flags: MessageFlags.Ephemeral
    });
  }

  // ✅ Nombre único del canal
  let channelName = `${tipo}-${interaction.user.username}`;
  let counter = 1;
  while (guild.channels.cache.some(c => c.name === channelName)) {
    channelName = `${tipo}-${interaction.user.username}-${counter++}`;
  }

  try {
    // ⚙️ Permisos base
    const perms = [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks
        ]
      },
      {
        id: client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.ManageChannels
        ]
      }
    ];

    // 👑 Roles según el tipo de ticket
    if (tipo === "donaciones") {
      perms.push({
        id: encargadoDonaciones,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks
        ]
      });
    } else {
      perms.push(
        {
          id: MOD_ROLES.moderador,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.AttachFiles,
            PermissionsBitField.Flags.EmbedLinks
          ]
        },
        {
          id: MOD_ROLES.soporte,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.AttachFiles,
            PermissionsBitField.Flags.EmbedLinks
          ]
        },
        {
          id: MOD_ROLES.admin,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.AttachFiles,
            PermissionsBitField.Flags.EmbedLinks
          ]
        }
      );
    }

    // 🆕 Crear el canal del ticket
    const channel = await guild.channels.create({
      name: channelName,
      type: 0,
      parent: cat,
      permissionOverwrites: perms
    });

    const embedTicket = new EmbedBuilder()
      .setTitle(label)
      .setDescription(`👋 Hola ${interaction.user}, gracias por abrir un ticket de **${label}**.\nUn miembro del staff te atenderá pronto.`)
      .setColor("Purple")
      .setTimestamp();

    const rowCerrar = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("cerrar_ticket").setLabel("Cerrar Ticket").setStyle(ButtonStyle.Danger)
    );

    const mention =
      tipo === "donaciones"
        ? `<@&${encargadoDonaciones}>`
        : `<@&${MOD_ROLES.moderador}> <@&${MOD_ROLES.soporte}> <@&${MOD_ROLES.admin}>`;

    await channel.send({
      content: mention,
      embeds: [embedTicket],
      components: [rowCerrar],
      allowedMentions: {
        roles:
          tipo === "donaciones"
            ? [encargadoDonaciones]
            : [MOD_ROLES.moderador, MOD_ROLES.soporte, MOD_ROLES.admin]
      }
    });

    await interaction.reply({
      content: `✅ Ticket creado correctamente: ${channel}`,
      flags: MessageFlags.Ephemeral
    });
  } catch (err) {
    console.error("❌ Error al crear ticket:", err);
    if (!interaction.replied) {
      await interaction.reply({
        content: "⚠️ Hubo un error al crear el ticket.",
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  } finally {
    interaction.ticketProcessing = false;
  }

  return;
}
    // ------------------- Botones ------------------- //
    if (interaction.isButton()) {
      const customId = interaction.customId;

  // 🔒 Cerrar ticket con transcript
if (customId === "cerrar_ticket") {
  await interaction.reply({
    content: "⏳ Cerrando ticket en 5 segundos...",
    flags: MessageFlags.Ephemeral
  });

  setTimeout(async () => {
    const channel = interaction.channel;
    if (!channel) return;

    try {
      // Obtener mensajes (máx 100)
      const messages = await channel.messages.fetch({ limit: 100 });
      const sorted = Array.from(messages.values()).sort(
        (a, b) => a.createdTimestamp - b.createdTimestamp
      );

      // Crear el contenido del transcript
      let transcriptContent = `Transcript del canal: #${channel.name}\nFecha de cierre: ${new Date().toLocaleString()}\n\n`;
      for (const msg of sorted) {
        const time = new Date(msg.createdTimestamp).toLocaleTimeString();
        transcriptContent += `[${time}] ${msg.author?.tag || "Sistema"}: ${msg.content || "(embed/archivo)"}\n`;
      }

      // Guardar el archivo en una ruta segura local
      const safePath = `./${channel.name}_transcript.txt`;
      fs.writeFileSync(safePath, transcriptContent, "utf8");

      // Enviar el transcript al canal de logs
      const logChannel = channel.guild.channels.cache.get(LOG_CHANNEL_TRANSCRIPTS_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle("🗒️ Transcript de Ticket Cerrado")
          .setDescription(`📁 Ticket cerrado: **#${channel.name}**\n👤 Cerrado por: ${interaction.user}`)
          .setColor("Purple")
          .setTimestamp();

        await logChannel.send({ embeds: [embed], files: [safePath] });
      }

      // Borrar el archivo local
      fs.unlinkSync(safePath);

      // Intentar borrar el canal
      await channel.delete().catch(err => {
        console.error("❌ Error eliminando canal:", err);
      });

    } catch (err) {
      console.error("❌ Error al cerrar ticket:", err);
      await interaction.followUp({
        content: "⚠️ Hubo un error al generar el transcript o cerrar el canal.",
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }, 5000);

  return;
}
// Whitelist
if (customId === "whitelist") {
  // Evitar doble click simultáneo
  if (cooldowns.has(interaction.user.id) && cooldowns.get(interaction.user.id) === 'processing') {
    return interaction.reply({
      content: "⚠️ Ya se está creando tu ticket, espera un momento...",
      flags: MessageFlags.Ephemeral
    });
  }

  cooldowns.set(interaction.user.id, 'processing'); // marcar como en proceso
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const now = Date.now();

  // Cooldown real
  if (cooldowns.has(userId) && typeof cooldowns.get(userId) === 'number' && now - cooldowns.get(userId) < COOLDOWN_HORAS * 60 * 60 * 1000) {
    cooldowns.delete(userId); // liberar lock
    return interaction.editReply({
      content: `⚠️ Ya hiciste un intento de whitelist. Espera un poco.`,
    });
  }

  // Bloqueo de ticket duplicado
  const userTickets = guild.channels.cache.filter(
    c => c.name.startsWith(`whitelist-${interaction.user.username}`)
  );
  if (userTickets.size > 0) {
    cooldowns.delete(userId);
    return interaction.editReply({
      content: `⚠️ Ya tienes un ticket de whitelist abierto: ${userTickets.first()}`,
    });
  }

  // Crear canal
  const channel = await guild.channels.create({
    name: `whitelist-${interaction.user.username}`,
    type: 0,
    parent: WHITELIST_CATEGORY_ID,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: MOD_ROLES.moderador, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: MOD_ROLES.soporte, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: MOD_ROLES.admin, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    ],
  });

  cooldowns.set(userId, now); // cooldown real

  await interaction.editReply({ content: `✅ Ticket de whitelist creado: ${channel}` });

        let puntaje = 0;
        for (let i = 0; i < preguntas.length; i++) {
          const respuesta = await hacerPregunta(channel, interaction.user, preguntas[i], i, preguntas.length);
          if (respuesta && respuesta === preguntas[i].respuesta) puntaje++;
        }

        const aprobado = puntaje >= 9;
        const resultadoEmbed = new EmbedBuilder()
          .setTitle(aprobado ? "✅ Whitelist Aprobada" : "❌ Whitelist Suspendida")
          .setDescription(aprobado
            ? `🎉 ¡Felicidades ${interaction.user}, Tu examen de whitelist ha sido aprobado. ¡Disfruta del servidor!\n**Puntaje:** ${puntaje}/${preguntas.length}`
            : `😢 Lo sentimos ${interaction.user}, no has aprobado la whitelist, en 6h tendras otro intento. ¡Suerte la proxima vez!.\n**Puntaje:** ${puntaje}/${preguntas.length}`)
          .setColor(aprobado ? "Green" : "Red");

        const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) logChannel.send({ embeds: [resultadoEmbed] });
        await channel.send({ embeds: [resultadoEmbed] });

        if (aprobado) {
          try {
            const member = await guild.members.fetch(interaction.user.id);
            await member.roles.add(ROLES.whitelist);
            await member.roles.remove(ROLES.sinWhitelist);
            await channel.send("🎉 ¡Has recibido el rol de **Whitelist**!");
          } catch (err) {
            console.error("❌ Error al asignar rol:", err);
            await channel.send("⚠️ Error al asignar rol, avisa a un staff.");
          }
        }

        setTimeout(() => channel.delete().catch(() => {}), 30000);
        return;
      }
    }
  } catch (error) {
    console.error("❌ Error en interactionCreate:", error);
    if (interaction.replied || interaction.deferred) {
      interaction.followUp({ content: "⚠️ Ocurrió un error.", flags: MessageFlags.Ephemeral }).catch(() => {});
    } else {
      interaction.reply({ content: "⚠️ Ocurrió un error.", flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

// ------------------- Bienvenidas ------------------- //
client.on("guildMemberAdd", async (member) => {
  try {
    const canalBienvenida = "1422298345241841824";
    const channel = member.guild.channels.cache.get(canalBienvenida);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle("🎉 ¡Nuevo miembro en **UNITY CITY**!")
      .setDescription(`Bienvenido/a ${member} a **${member.guild.name}** 🚀\n👉 No olvides leer las normas y realizar la whitelist.`)
      .setColor("Purple")
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: "UNITY CITY RP", iconURL: member.guild.iconURL() })
      .setTimestamp();

    channel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    console.error("❌ Error en guildMemberAdd:", err);
  }
});

// ------------------- Manejo global de errores ------------------- //
process.on('exit', (code) => console.log(`⚠️ Proceso finalizado con código ${code}`));
process.on('uncaughtException', (err) => console.error('❌ Excepción no capturada:', err));
process.on('unhandledRejection', (reason) => console.error('❌ Promesa no manejada:', reason));

// ------------------- Login ------------------- //
client.login(process.env.TOKEN)
  .then(() => console.log("🔓 Login exitoso. Bot conectado a Discord."))
  .catch(err => console.error("❌ Error al iniciar sesión:", err));
