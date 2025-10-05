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

client.once("ready", () => {
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
    msg.awaitMessageComponent({ filter, time: 60000 })
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
  if (!interaction.isCommand() && !interaction.isStringSelectMenu() && !interaction.isButton()) return;

  // ---- /setup-soporte ----
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
          { label: "Soporte General", value: "soporte_general", emoji: "🟢" },
          { label: "Reportes", value: "reportes", emoji: "🐞" },
          { label: "CK", value: "ck", emoji: "💀" },
          { label: "Donaciones", value: "donaciones", emoji: "💸" },
          { label: "Facciones", value: "facciones", emoji: "🏢" },
          { label: "Postulación", value: "postulacion", emoji: "📋" }
        ])
    );

    return await interaction.reply({ embeds: [embed], components: [row] });
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
      .setColor("Blue");

    const rowCerrar = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("cerrar_ticket").setLabel("Cerrar Ticket").setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: `<@&${MOD_ROLES.moderador}> <@&${MOD_ROLES.soporte}> <@&${MOD_ROLES.admin}>`,
      embeds: [embedTicket],
      components: [rowCerrar],
      allowedMentions: { roles: [MOD_ROLES.moderador, MOD_ROLES.soporte, MOD_ROLES.admin] }
    });

    return interaction.reply({ content: `✅ Ticket creado: ${channel}`, ephemeral: true });
  }

  // ---- Cerrar ticket ----
  if (interaction.isButton() && interaction.customId === "cerrar_ticket") {
    await interaction.reply({ content: "⏳ Cerrando ticket en 5 segundos...", ephemeral: true });
    return setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
  }

  // ---- /negocios ----
  if (interaction.isCommand() && interaction.commandName === "negocios") {
    const STAFF_ROLE_ID = "1254109535602344026";
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
      return interaction.reply({ content: "❌ No tienes permiso para usar este comando.", ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle("🏢 Solicitud de Negocio - UNITY CITY")
      .setDescription(
        "📋 **Formato de Solicitud:**\n\n" +
        "📛 **Nombre del Negocio:**\n" +
        "👤 **Motivo por el que quieres postular:**\n" +
        "💼 **Jerarquía de rangos:**\n" +
        "💰 **Normativa del local:**\n" +
        "📍 **Ubicación (si aplica):**\n" +
        "🧾 **Tipos de eventos:**"
      )
      .setColor("Purple")
      .setFooter({ text: "UNITY CITY RP | Departamento de Economía" });

    return interaction.reply({ embeds: [embed] });
  }

  // ---- /streamer ----
  if (interaction.isCommand() && interaction.commandName === "streamer") {
    const STAFF_ROLE_ID = "1254109535602344026";
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
      return interaction.reply({ content: "❌ No tienes permiso para usar este comando.", ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle("🎥 Solicitud de Streamer - UNITY CITY")
      .setDescription(
        "📋 **Formato de Solicitud:**\n\n" +
        "🧑‍💻 **Nombre OOC:**\n" +
        "⏰ **Tiempo en el servidor:**\n" +
        "⌛ **Horas en FiveM:**\n" +
        "🔗 **URL de Steam:**\n" +
        "📹 **Redes sociales donde transmitirías:**"
      )
      .setColor("Purple")
      .setFooter({ text: "UNITY CITY RP | Postulación Streamer" });

    return interaction.reply({ embeds: [embed] });
  }

  // ---- /pstaff ----
  if (interaction.isCommand() && interaction.commandName === "pstaff") {
    const STAFF_ROLE_ID = "1254109535602344026";
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
      return interaction.reply({ content: "❌ No tienes permiso para usar este comando.", ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle("🛠️ Postulación STAFF - UNITY CITY")
      .setDescription(
        "📋 **Formato de Solicitud:**\n\n" +
        "🧑‍💻 **Nombre OOC:**\n" +
        "🎂 **Edad OOC:**\n" +
        "⏰ **Tiempo en el servidor:**\n" +
        "⚠️ **¿Tienes alguna sanción?:**\n" +
        "💬 **Cualidades y puntos fuertes:**\n" +
        "📆 **Disponibilidad horaria:**\n" +
        "🔗 **URL de Steam:**"
      )
      .setColor("Blue")
      .setFooter({ text: "UNITY CITY RP | Postulación STAFF" });

    return interaction.reply({ embeds: [embed] });
  }
});

// ------------------- Bienvenidas ------------------- //
client.on("guildMemberAdd", async (member) => {
  const canalBienvenida = "1422298345241841824";
  const channel = member.guild.channels.cache.get(canalBienvenida);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("🎉 ¡Nuevo miembro en UNITY CITY!")
    .setDescription(`Bienvenido/a ${member} a **${member.guild.name}** 🚀\n👉 No olvides leer las normas y realizar la whitelist.`)
    .setColor("Purple")
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: "UNITY CITY RP", iconURL: member.guild.iconURL() });

  channel.send({ embeds: [embed] });
});

// ------------------- Login ------------------- //
client.login(process.env.TOKEN);
