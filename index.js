const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  REST,
  Routes
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
const SOPORTE_CATEGORY_ID = "1422898157829881926"; // Categoría soporte
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

// ------------------- Manejo de interacciones ------------------- //
client.on("interactionCreate", async (interaction) => {
  const guild = interaction.guild;

  // ---- Slash Command setup-soporte ----
  if (interaction.isCommand() && interaction.commandName === "setup-soporte") {
    try {
      if (!interaction.channel) return interaction.reply({ content: "❌ No se pudo encontrar el canal.", ephemeral: true });

      const botMember = await guild.members.fetch(client.user.id);
      const botPerms = interaction.channel.permissionsFor(botMember);
      const missingPerms = [];
      if (!botPerms.has("SendMessages")) missingPerms.push("Enviar mensajes");
      if (!botPerms.has("EmbedLinks")) missingPerms.push("Enviar embeds");
      if (!botPerms.has("UseExternalEmojis")) missingPerms.push("Usar emojis externos");

      if (missingPerms.length > 0)
        return interaction.reply({ content: `❌ No tengo permisos suficientes: ${missingPerms.join(", ")}`, ephemeral: true });

      const category = guild.channels.cache.get(SOPORTE_CATEGORY_ID);
      if (!category || category.type !== 4)
        return interaction.reply({ content: "❌ La categoría de soporte no existe o no es válida. Revisa SOPORTE_CATEGORY_ID.", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle("🎫 Sistema de Tickets - UNITY CITY")
        .setDescription("Selecciona el tipo de ticket que quieras abrir 👇")
        .setColor("Purple");

      // ---- Corrección: dividir botones en 2 filas (máx 5 por fila) ----
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("soporte_general").setLabel("Soporte").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("reportes").setLabel("Reportes").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("ck").setLabel("CK").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("donaciones").setLabel("Donaciones").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("facciones").setLabel("Facciones").setStyle(ButtonStyle.Primary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("postulacion").setLabel("Postulación").setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row1, row2] });
    } catch (err) {
      console.error("Error al ejecutar setup-soporte:", err);
      interaction.reply({ content: `❌ Error: ${err.message}`, ephemeral: true });
    }
    return;
  }

  // ---- Slash Command setup-whitelist ----
  if (interaction.isCommand() && interaction.commandName === "setup-whitelist") {
    try {
      if (!interaction.channel) return interaction.reply({ content: "❌ No se pudo encontrar el canal.", ephemeral: true });

      const botMember = await guild.members.fetch(client.user.id);
      const botPerms = interaction.channel.permissionsFor(botMember);
      const missingPerms = [];
      if (!botPerms.has("SendMessages")) missingPerms.push("Enviar mensajes");
      if (!botPerms.has("EmbedLinks")) missingPerms.push("Enviar embeds");
      if (!botPerms.has("UseExternalEmojis")) missingPerms.push("Usar emojis externos");

      if (missingPerms.length > 0)
        return interaction.reply({ content: `❌ No tengo permisos suficientes: ${missingPerms.join(", ")}`, ephemeral: true });

      const category = guild.channels.cache.get(WHITELIST_CATEGORY_ID);
      if (!category || category.type !== 4)
        return interaction.reply({ content: "❌ La categoría de whitelist no existe o no es válida. Revisa WHITELIST_CATEGORY_ID.", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle("📋 Sistema de Whitelist")
        .setDescription("Pulsa el botón para iniciar tu whitelist. Tendrás 1 minuto por pregunta.")
        .setColor("Purple");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("whitelist").setLabel("Iniciar Whitelist").setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error("Error al ejecutar setup-whitelist:", err);
      interaction.reply({ content: `❌ Error: ${err.message}`, ephemeral: true });
    }
    return;
  }

  // ---- Manejo de botones ----
  const ticketMap = {
    soporte_general: { cat: SOPORTE_CATEGORY_ID, label: "🟢 Ticket de Soporte General" },
    reportes: { cat: "1423746566610620568", label: "🐞 Ticket de Reportes" },
    ck: { cat: "1423746747741765632", label: "💀 Ticket de CK" },
    donaciones: { cat: "1423747380637073489", label: "💸 Ticket de Donaciones" },
    facciones: { cat: "1423747506382311485", label: "🏢 Ticket de Facciones" },
    postulacion: { cat: "1423747604495466536", label: "📋 Ticket de Postulación" }
  };

  if (interaction.isButton()) {
    // ---- Whitelist ----
    if (interaction.customId === "whitelist") {
      const userId = interaction.user.id;
      const now = Date.now();
      if (cooldowns[userId] && now - cooldowns[userId] < COOLDOWN_HORAS * 60 * 60 * 1000) {
        const remaining = COOLDOWN_HORAS * 60 * 60 * 1000 - (now - cooldowns[userId]);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        return interaction.reply({ content: `⚠️ Ya hiciste un intento. Espera ${hours}h ${minutes}m.`, ephemeral: true });
      }
      cooldowns[userId] = now;

      const channel = await guild.channels.create({
        name: `whitelist-${interaction.user.username}`,
        type: 0,
        parent: WHITELIST_CATEGORY_ID,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
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
        .setDescription(aprobado ? `🎉 ¡
