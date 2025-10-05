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
  REST,
  Routes
} = require("discord.js");
const fs = require("fs");
const express = require("express");
require("dotenv").config();

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

// ------------------- Comandos ------------------- //
const commands = [
  { name: "streamer", description: "Formulario de solicitud de Streamer" },
  { name: "ilegales", description: "Formulario de solicitud de Banda Ilegal" },
  { name: "pstaff", description: "Formulario de postulación a STAFF" },
  { name: "negocios", description: "Formulario de solicitud de Negocio" },
  { name: "setup-soporte", description: "Configura el sistema de tickets" }
];

// Registrar comandos en el servidor
client.on("clientReady", async () => {
  console.log(`✅ Bot iniciado como: ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "UNITY CITY 🎮", type: 0 }],
    status: "online",
  });

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    console.log("🔄 Registrando comandos en el servidor...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("✅ Comandos registrados correctamente.");
  } catch (error) {
    console.error("❌ Error registrando comandos:", error);
  }
});

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

  // ---- Comandos Slash ---- //
  if (interaction.isCommand()) {
    const STAFF_ROLE_ID = "1254109535602344026";

    // Solo staff puede usar ciertos comandos
    if (["negocios", "ilegales", "streamer", "pstaff"].includes(interaction.commandName)) {
      if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
        return interaction.reply({ content: "❌ No tienes permiso para usar este comando.", ephemeral: true });
      }
    }

    // ---- /negocios ----
    if (interaction.commandName === "negocios") {
      const embed = new EmbedBuilder()
        .setTitle("🏢 Solicitud de Negocio - UNITY CITY")
        .setDescription(`
Por favor copia este formato y complétalo para enviar tu solicitud de negocio:

📛 **Nombre del Negocio:**
👤 **Motivo por el que quieres postular a ese negocio:**
💼 **Jerarquia de rangos:**
💰 **Normativa del local:**
📍 **Ubicación (si aplica):**
🧾 **Tipos de eventos:**
        `)
        .setColor("Purple")
        .setFooter({ text: "UNITY CITY RP | NEGOCIOS" })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    // ---- /ilegales ----
    if (interaction.commandName === "ilegales") {
      const embed = new EmbedBuilder()
        .setTitle("💀 Solicitud de Banda Ilegal - UNITY CITY")
        .setDescription(`
Por favor copia este formato y complétalo para enviar tu solicitud de ilegales:

ORIGEN DE LA BANDA:
HISTORIA Y EXPANSION DE LA BANDA:
ESTRUCTURA Y SIMBOLOS QUE LES REPRESENTEN:
PERSONALIDAD Y REPUTACION:
QUE VAIS A APORTAR AL SERVIDOR DE NUEVO, COMO PRETENDEIS FOMENTAR EL ROL?
DISPONIBILIDAD HORARIA DE LOS MIEMBROS DE LA BANDA, E INTENCION DE PROGRESION DE LA MISMA:

FOTO DE LA UBICACION DEL BARRIO:

INTEGRANTES:

BOCETO O FOTO DE EL GRAFITI:
        `)
        .setColor("Purple")
        .setFooter({ text: "UNITY CITY RP | ILEGALES" })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    // ---- /streamer ----
    if (interaction.commandName === "streamer") {
      const embed = new EmbedBuilder()
        .setTitle("🎥 Solicitud de Streamer - UNITY CITY")
        .setDescription(`
Por favor copia este formato y complétalo para enviar tu solicitud de streamer:

NOMBRE OOC:
CUANTO TIEMPO LLEVAS EN EL SERVIDOR:
HORAS EN FIVEM:
URL STEAM:
LINK DE TUS REDES SOCIALES EN LAS QUE TRANSMITIRIAS:
        `)
        .setColor("Purple")
        .setFooter({ text: "UNITY CITY RP | POSTULACION STREAMER" })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    // ---- /pstaff ----
    if (interaction.commandName === "pstaff") {
      const embed = new EmbedBuilder()
        .setTitle("POSTULACION STAFF - UNITY CITY")
        .setDescription(`
Por favor copia este formato y complétalo para enviar tu postulacion a STAFF:

NOMBRE OOC:
EDAD OOC:
CUANTO TIEMPO LLEVAS EN EL SERVIDOR:
TIENES ALGUNA SANCION ADMINISTRATIVA:
CUALIDADES Y PUNTOS FUERTES:
DISPONIBILIDAD HORARIA:
URL DE STEAM:
        `)
        .setColor("Purple")
        .setFooter({ text: "UNITY CITY RP | POSTULACION STAFF" })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    // ---- /setup-soporte ----
    if (interaction.commandName === "setup-soporte") {
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
  }

  // Aquí sigue tu código de tickets, botones y whitelist...
});

// ------------------- Bienvenidas ------------------- //
client.on("guildMemberAdd", async (member) => {
  const canalBienvenida = "1422298345241841824";
  const channel = member.guild.channels.cache.get(canalBienvenida);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("🎉 ¡Nuevo miembro en **UNITY CITY**!")
    .setDescription(`Bienvenido/a ${member} a **${member.guild.name}** 🚀`)
    .setColor("Purple")
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

  channel.send({ embeds: [embed] });
});

// ------------------- Login ------------------- //
client.login(process.env.TOKEN);
