const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
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

// ------------------- Función hacer pregunta ------------------- //
async function hacerPregunta(channel, usuario, pregunta, index, total) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("a").setLabel("a").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("b").setLabel("b").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("c").setLabel("c").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("d").setLabel("d").setStyle(ButtonStyle.Secondary)
  );

  const opciones = pregunta.opciones
    .map((texto, i) => `${String.fromCharCode(97 + i)}) ${texto}`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`❓ Pregunta ${index + 1} de ${total}`)
    .setDescription(`**${pregunta.pregunta}**\n\n${opciones}`)
    .setColor("Purple");

  const msg = await channel.send({ embeds: [embed], components: [row] });

  return new Promise((resolve) => {
    const filter = (i) => i.user.id === usuario.id;
    channel
      .awaitMessageComponent({ filter, time: 60000 })
      .then(async (interaction) => {
        interaction.deferUpdate().catch(() => {});
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

// ------------------- Manejo de mensajes ------------------- //
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ---- Setup Whitelist ----
  if (message.content.startsWith("!setup-whitelist")) {
    const embed = new EmbedBuilder()
      .setTitle("📋 Sistema de Whitelist")
      .setDescription("Pulsa el botón para iniciar tu whitelist. Tendrás 1 minuto por pregunta.")
      .setColor("Purple");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("whitelist")
        .setLabel("Iniciar Whitelist")
        .setStyle(ButtonStyle.Primary)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
  }

  // ---- Resetear cooldown ----
  if (message.content.startsWith("!resetcooldown")) {
    if (!message.member.permissions.has("Administrator")) {
      return message.reply("❌ No tienes permisos para usar este comando.");
    }

    const args = message.content.split(" ");
    const userId = args[1]?.replace(/[<@!>]/g, "");
    if (!userId || !cooldowns[userId]) {
      return message.reply("❌ Usuario no encontrado o no tiene cooldown.");
    }

    delete cooldowns[userId];
    message.channel.send(`✅ Se ha reseteado el cooldown de <@${userId}>.`);
  }
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ---- Setup Soporte ----
  if (message.content.startsWith("!setup-soporte")) {
    try {
      // Verificar que el bot pueda enviar mensajes y embeds
      const botMember = await message.guild.members.fetch(client.user.id);
      const botPerms = message.channel.permissionsFor(botMember);
      if (!botPerms.has("SendMessages") || !botPerms.has("EmbedLinks") || !botPerms.has("UseExternalEmojis")) {
        return message.reply("❌ No tengo permisos suficientes para enviar el panel de tickets en este canal.");
      }

      // Embed del panel de soporte
      const embed = new EmbedBuilder()
        .setTitle("🎫 Sistema de Tickets - UNITY CITY")
        .setDescription("Selecciona el tipo de ticket que quieras abrir 👇")
        .setColor("Purple");

      // Botones
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("soporte_general").setLabel("Soporte").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("reportes").setLabel("Reportes").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("ck").setLabel("CK").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("donaciones").setLabel("Donaciones").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("facciones").setLabel("Facciones").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("postulacion").setLabel("Postulación").setStyle(ButtonStyle.Secondary)
      );

      // Enviar el embed con botones
      await message.channel.send({ embeds: [embed], components: [row] });

      // Confirmación para el administrador
      await message.reply({ content: "✅ Panel de soporte creado correctamente.", ephemeral: true });
    } catch (err) {
      console.error("Error al ejecutar !setup-soporte:", err);
      message.reply("❌ Ocurrió un error al crear el panel de tickets. Revisa la consola.");
    }
  }
});

// ------------------- Manejo de botones ------------------- //
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  const guild = interaction.guild;

  // ---- WHITELIST ----
  if (interaction.customId === "whitelist") {
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
        ? `🎉 ¡Felicidades ${interaction.user}, has aprobado la whitelist!\n\n**Puntaje:** ${puntaje}/${preguntas.length}`
        : `😢 Lo sentimos ${interaction.user}, no has aprobado la whitelist.\n\n**Puntaje:** ${puntaje}/${preguntas.length}`)
      .setColor(aprobado ? "Green" : "Red");

    await channel.send({ embeds: [resultadoEmbed] });

    if (aprobado) {
      try {
        const member = await guild.members.fetch(interaction.user.id);
        await member.roles.add(ROLES.whitelist);
        await member.roles.remove(ROLES.sinWhitelist);
        await channel.send("🎉 ¡Felicidades! Has recibido el rol de **Whitelist**.");
      } catch (err) {
        console.error("❌ Error al asignar rol:", err);
        await channel.send("⚠️ Error al asignar o quitar el rol, avisa a un staff.");
      }
    }

    const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) logChannel.send({ content: `${interaction.user}`, embeds: [resultadoEmbed] });

    setTimeout(() => channel.delete().catch(() => {}), 30000);
    return;
  }

  // ---- TICKETS DE SOPORTE ----
  const ticketMap = {
    soporte_general: { cat: SOPORTE_CATEGORY_ID, label: "🟢 Ticket de Soporte General" },
    reportes: { cat: "1423746566610620568", label: "🐞 Ticket de Reportes" },
    ck: { cat: "1423746747741765632", label: "💀 Ticket de CK" },
    donaciones: { cat: "1423747380637073489", label: "💸 Ticket de Donaciones" },
    facciones: { cat: "1423747506382311485", label: "🏢 Ticket de Facciones" },
    postulacion: { cat: "1423747604495466536", label: "📋 Ticket de Postulación" }
  };

  if (ticketMap[interaction.customId]) {
    const { cat, label } = ticketMap[interaction.customId];
    const channel = await guild.channels.create({
      name: `${interaction.customId}-${interaction.user.username}`,
      type: 0,
      parent: cat,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      ]
    });

    await interaction.reply({ content: `✅ Ticket creado: ${channel}`, ephemeral: true });

    const embedTicket = new EmbedBuilder()
      .setTitle(label)
      .setDescription(`👋 Hola ${interaction.user}, gracias por abrir un ticket de **${label}**.\n\nUn miembro del staff te atenderá pronto. 🚀`)
      .setColor("Blue")
      .setTimestamp();

    const rowCerrar = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("cerrar_ticket").setLabel("Cerrar Ticket").setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embedTicket], components: [rowCerrar] });
    return;
  }

  // ---- CERRAR TICKET ----
  if (interaction.customId === "cerrar_ticket") {
    await interaction.reply("⏳ Cerrando ticket en 5 segundos...");
    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
  }
});

// ------------------- Bienvenidas ------------------- //
client.on("guildMemberAdd", async (member) => {
  const canalBienvenida = "1422298345241841824";
  const channel = member.guild.channels.cache.get(canalBienvenida);
  if (!channel) return console.error("❌ No encontré el canal de bienvenida.");

  const embed = new EmbedBuilder()
    .setTitle("🎉 ¡Nuevo miembro en **UNITY CITY**!")
    .setDescription(
      `Bienvenido/a ${member} a **${member.guild.name}** 🚀\n\n` +
      "👉 No olvides leer las normas y realizar la whitelist para tener acceso al servidor.\n" +
      "¡Disfruta tu estancia con nosotros!"
    )
    .setColor("Purple")
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: "UNITY CITY RP", iconURL: member.guild.iconURL() })
    .setTimestamp();

  channel.send({ embeds: [embed] });
});

// ------------------- LOGIN ------------------- //
client.login(process.env.TOKEN);

