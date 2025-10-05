const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionsBitField
} = require("discord.js");
const fs = require("fs");
const express = require("express");

// ------------------- Servidor web ------------------- //
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("✅ Bot activo y funcionando!"));
app.listen(PORT, () => console.log(`🌐 Servidor web activo en puerto ${PORT}`));

// ------------------- Config ------------------- //
const preguntas = JSON.parse(fs.readFileSync("preguntas.json", "utf8"));
const LOG_CHANNEL_ID = "1422893357042110546";
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
const cooldowns = {};

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

client.on("ready", () => {
  console.log(`✅ Bot iniciado como: ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "UNITY CITY 🎮", type: 0 }],
    status: "online",
  });
});

// ------------------- Función hacer pregunta (Whitelist con botones) ------------------- //
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
    msg
      .awaitMessageComponent({ filter, time: 60000 })
      .then(async (interaction) => {
        await interaction.deferUpdate().catch(() => {});
        await msg.delete().catch(() => {});
        resolve(interaction.customId);
      })
      .catch(() => {
        msg.delete().catch(() => {});
        channel.send("⏰ Tiempo agotado, pasamos a la siguiente.");
        resolve(null);
      });
  });
}

// ------------------- Interacciones ------------------- //
client.on("interactionCreate", async (interaction) => {
  const guild = interaction.guild;

  // ---- Setup Soporte (Select Menu) ----
  if (interaction.isCommand() && interaction.commandName === "setup-soporte") {
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
  }

  // ---- Ticket Select ----
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
    const ticketMap = {
      soporte_general: { cat: SOPORTE_CATEGORY_ID, label: "🟢 Ticket de Soporte General" },
      reportes: { cat: "1423746566610620568", label: "🐞 Ticket de Reportes" },
      ck: { cat: "1423746747741765632", label: "💀 Ticket de CK" },
      donaciones: { cat: "1423747380637073489", label: "💸 Ticket de Donaciones" },
      facciones: { cat: "1423747506382311485", label: "🏢 Ticket de Facciones" },
      postulacion: { cat: "1423747604495466536", label: "📋 Ticket de Postulación" }
    };

    const { cat, label } = ticketMap[interaction.values[0]];

    const channel = await guild.channels.create({
      name: `${interaction.values[0]}-${interaction.user.username}`,
      type: 0,
      parent: cat,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    const embedTicket = new EmbedBuilder()
      .setTitle(label)
      .setDescription(`👋 Hola ${interaction.user}, gracias por abrir un ticket de **${label}**. Un miembro del staff te atenderá pronto.`)
      .setColor("Blue")
      .setTimestamp();

    const rowCerrar = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("cerrar_ticket").setLabel("Cerrar Ticket").setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: `<@&${MOD_ROLES.moderador}> <@&${MOD_ROLES.soporte}> <@&${MOD_ROLES.admin}>`,
      embeds: [embedTicket],
      components: [rowCerrar],
      allowedMentions: { roles: [MOD_ROLES.moderador, MOD_ROLES.soporte, MOD_ROLES.admin] }
    });

    await interaction.reply({ content: `✅ Ticket creado: ${channel}`, ephemeral: true });
  }

  // ---- Cerrar ticket ----
  if (interaction.isButton() && interaction.customId === "cerrar_ticket") {
    await interaction.reply({ content: "⏳ Cerrando ticket en 5 segundos...", ephemeral: true });
    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
  }

  // ---- Botón Whitelist ----
  if (interaction.isButton() && interaction.customId === "whitelist") {
    const userId = interaction.user.id;
    const now = Date.now();

    if (cooldowns[userId] && now - cooldowns[userId] < COOLDOWN_HORAS * 60 * 60 * 1000) {
      const remaining = COOLDOWN_HORAS * 60 * 60 * 1000 - (now - cooldowns[userId]);
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      return interaction.reply({
        content: `⚠️ Ya hiciste un intento de whitelist. Debes esperar ${hours}h ${minutes}m antes de intentarlo de nuevo.`,
        ephemeral: true,
      });
    }

    cooldowns[userId] = now;

    const channel = await guild.channels.create({
      name: `whitelist-${interaction.user.username}`,
      type: 0,
      parent: WHITELIST_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      ],
    });

    await interaction.reply({ content: `✅ Ticket de whitelist creado: ${channel}`, ephemeral: true });

    let puntaje = 0;
    for (let i = 0; i < preguntas.length; i++) {
      const respuesta = await hacerPregunta(channel, interaction.user, preguntas[i], i, preguntas.length);
      if (respuesta && respuesta === preguntas[i].respuesta) puntaje++;
    }

    const aprobado = puntaje >= 9;
    const resultadoEmbed = new EmbedBuilder()
  .setTitle(aprobado ? "✅ Whitelist Aprobada" : "❌ Whitelist Suspendida")
  .setDescription(aprobado
    ? `🎉 ¡Felicidades ${interaction.user}, has aprobado la whitelist!\n**Puntaje:** ${puntaje}/${preguntas.length}`
    : `😢 Lo sentimos ${interaction.user}, no has aprobado la whitelist.\n**Puntaje:** ${puntaje}/${preguntas.length}`)
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
  }
});

// ------------------- Bienvenidas ------------------- //
client.on("guildMemberAdd", async (member) => {
  const canalBienvenida = "1422298345241841824";
  const channel = member.guild.channels.cache.get(canalBienvenida);
  if (!channel) return console.error("❌ No encontré el canal de bienvenida.");

  const embed = new EmbedBuilder()
    .setTitle("🎉 ¡Nuevo miembro en **UNITY CITY**!")
    .setDescription(`Bienvenido/a ${member} a **${member.guild.name}** 🚀\n👉 No olvides leer las normas y realizar la whitelist.`)
    .setColor("Purple")
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: "UNITY CITY RP", iconURL: member.guild.iconURL() })
    .setTimestamp();

  channel.send({ embeds: [embed] });
});

//COMANDOS

// ---- Comando /negocios ----
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "negocios") {
    // Verificamos que solo los staff puedan usarlo (usa el ID de tu rol staff)
    const STAFF_ROLE_ID = "1254109535602344026";
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: "❌ No tienes permiso para usar este comando.", ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle("🏢 Solicitud de Negocio - UNITY CITY")
      .setDescription(
        "Por favor copia este formato y complétalo para enviar tu solicitud de negocio, adjuntar en este ticket al estilo PDF y un encargado os lo revisara. Recordar ser creativos, y sobre todo tener buenas ideas.Suerte!!:\n\n" +
        "📛 **Nombre del Negocio:**\n" +
        "👤 **Motivo por el que quieres postular a ese negocio:**\n" +
        "💼 **Jerarquia de rangos:**\n" +
        "💰 **Normativa del local:**\n" +
        "📍 **Ubicación (si aplica):**\n" +
        "🧾 **Tipos de eventos:**\n" +
      )
      .setColor("Purple")
      .setFooter({ text: "UNITY CITY RP | Departamento de Economía" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
});

// ---- Comando /negocios ----
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "streamer") {
    // Verificamos que solo los staff puedan usarlo (usa el ID de tu rol staff)
    const STAFF_ROLE_ID = "1254109535602344026";
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: "❌ No tienes permiso para usar este comando.", ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle("Solicitud de Streamer - UNITY CITY")
      .setDescription(
        "Por favor copia este formato y complétalo para enviar tu solicitud de streamer:\n\n" +
        "NOMBRE OOC:**\n" +
        "CUANTO TIEMPO LLEVAS EN EL SERVIDOR:**\n" +
        "HORAS EN FIVEM:**\n" +
        "URL STEAM:**\n" +
        "LINK DE TUS REDES SOCIALES EN LAS QUE TRANSMITIRIAS**\n" +
      )
      .setColor("Purple")
      .setFooter({ text: "UNITY CITY RP | POSTULACION STREAMER" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
});

// ---- Comando /pstaff ----
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "pstaff") {
    // Verificamos que solo los staff puedan usarlo (usa el ID de tu rol staff)
    const STAFF_ROLE_ID = "1254109535602344026";
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: "❌ No tienes permiso para usar este comando.", ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle("POSTULACION STAFF - UNITY CITY")
      .setDescription(
        "Por favor copia este formato y complétalo para enviar tu postulacion a STAFF:\n\n" +
        "NOMBRE OOC:**\n" +
        "EDAD OOC:**\n" +
        "CUANTO TIEMPO LLEVAS EN EL SERVIDOR:**\n" +
        "TIENES ALGUNA SANCION ADMINISTRATIVA:**\n" +
        "CUALIDADES Y PUNTOS FUERTES:**\n" +
        "DISPONIBILIDAD HORARIA**\n" +
        "URL DE STEAM**\n" +
      )
      .setColor("Purple")
      .setFooter({ text: "UNITY CITY RP | POSTULACION STAFF" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
});



// ------------------- Login ------------------- //
client.login(process.env.TOKEN);
