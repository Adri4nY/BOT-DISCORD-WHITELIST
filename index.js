// ------------------- Cargar variables de entorno ------------------- //
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
const RESET_LOG_CHANNEL_ID = "1424694967472754769";
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

// ------------------- Evento ClientReady ------------------- //
client.on("ready", async () => {
  console.log(`✅ Bot iniciado como: ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "UNITY CITY 🎮", type: 0 }],
    status: "online",
  });

  // ------------------- Registrar Comandos Slash ------------------- //
  const commands = [
    new SlashCommandBuilder()
      .setName("setup-soporte")
      .setDescription("Configura el sistema de soporte."),
    new SlashCommandBuilder()
      .setName("reset-whitelist")
      .setDescription("Resetea la whitelist de un usuario para que pueda volver a hacerla.")
      .addUserOption(option =>
        option.setName("usuario")
          .setDescription("Usuario al que se le resetea la whitelist.")
          .setRequired(true))
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("✅ Comandos registrados correctamente.");
  } catch (err) {
    console.error("❌ Error al registrar comandos:", err);
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

// ------------------- Interacciones ------------------- //
client.on("interactionCreate", async (interaction) => {
  try {
    const guild = interaction.guild;
    if (!guild) return;

    // ------------------- /reset-whitelist ------------------- //
    if (interaction.isChatInputCommand() && interaction.commandName === "reset-whitelist") {
      const member = await guild.members.fetch(interaction.user.id);
      const allowedRoles = [MOD_ROLES.admin, MOD_ROLES.moderador, MOD_ROLES.soporte];

      if (!allowedRoles.some(role => member.roles.cache.has(role))) {
        return interaction.reply({
          content: "❌ No tienes permiso para usar este comando.",
          flags: MessageFlags.Ephemeral
        });
      }

      const target = interaction.options.getUser("usuario");
      if (!target) return interaction.reply({ content: "⚠️ Usuario no válido.", flags: MessageFlags.Ephemeral });

      if (!cooldowns.has(target.id)) return interaction.reply({ content: `ℹ️ ${target.username} no tiene cooldown activo.`, flags: MessageFlags.Ephemeral });

      cooldowns.delete(target.id);

      const embedReset = new EmbedBuilder()
        .setTitle("♻️ Whitelist Reseteada")
        .setDescription(`✅ Se ha reseteado la whitelist de **${target.username}**.\nAhora puede volver a intentarla sin esperar.`)
        .setColor("Green")
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Reseteado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      await interaction.reply({ embeds: [embedReset], flags: MessageFlags.Ephemeral });

      const logChannel = guild.channels.cache.get(RESET_LOG_CHANNEL_ID);
      if (logChannel) {
        const embedLog = new EmbedBuilder()
          .setTitle("🧹 Whitelist Reseteada")
          .setDescription(`El usuario **${target.tag}** ha sido reseteado.`)
          .addFields(
            { name: "👮‍♂️ Staff:", value: `${interaction.user.tag}`, inline: true },
            { name: "🎯 Usuario:", value: `${target.tag}`, inline: true },
            { name: "🕒 Fecha:", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
          )
          .setColor("Orange")
          .setThumbnail(target.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: "Sistema de Whitelist - UNITY CITY" })
          .setTimestamp();
        await logChannel.send({ embeds: [embedLog] });
      }
    }

    // ------------------- /setup-soporte ------------------- //
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
    }

    // ------------------- Comandos de pautas ------------------- //
    if (interaction.isChatInputCommand()) {
      const commandName = interaction.commandName;
      const allowedCommands = ["pstaff", "pilegales", "pnegocios", "pck", "pstreamer"];
      if (allowedCommands.includes(commandName)) {
        const embed = new EmbedBuilder()
          .setTitle(`📌 Pautas para ${commandName.replace("p", "").toUpperCase()}`)
          .setColor("Purple")
          .setFooter({ text: "UNITY CITY RP - Postulación" })
          .setTimestamp();

        switch (commandName) {
          case "pilegales":
            embed.addFields(
              { name: "Formato", value: "PDF OBLIGATORIO", inline: false },
              { name: "Origen de la banda", value: "Describe el origen de la banda.", inline: false },
              { name: "Historia y expansión", value: "Explica la historia y expansión de la banda.", inline: false },
              { name: "Estructura y símbolos", value: "Detalla la estructura y símbolos que representen la banda.", inline: false },
              { name: "Personalidad y reputación", value: "Describe la personalidad y reputación.", inline: false },
              { name: "Aportación al servidor", value: "Qué vais a aportar y cómo fomentaréis el rol.", inline: false },
              { name: "Disponibilidad", value: "Disponibilidad horaria de los miembros y planes de progresión.", inline: false },
              { name: "Ubicación", value: "Foto de la ubicación del barrio.", inline: false },
              { name: "Integrantes", value: "Lista de integrantes.", inline: false },
              { name: "Grafiti", value: "Boceto o foto del grafiti.", inline: false }
            );
            break;
          case "pnegocios":
            embed.setDescription("Aquí van las pautas para negocios...");
            break;
          case "pstaff":
            embed.setDescription("Aquí van las pautas para staff...");
            break;
          case "pck":
            embed.setDescription("Aquí van las pautas para CK...");
            break;
          case "pstreamer":
            embed.setDescription("Aquí van las pautas para streamers...");
            break;
        }

        await interaction.reply({ embeds: [embed], ephemeral: false });
      }
    }

    // ------------------- Aquí irían los demás botones e interacciones como whitelist, tickets, cerrar ticket, etc. ------------------- //

  } catch (error) {
    console.error("❌ Error en interactionCreate:", error);
    if (interaction.replied || interaction.deferred) {
      interaction.followUp({
        content: "⚠️ Ocurrió un error al procesar tu interacción.",
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    } else {
      interaction.reply({
        content: "⚠️ Ocurrió un error al procesar tu interacción.",
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
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

// ------------------- Login ------------------- //
client.login(process.env.TOKEN)
  .then(() => console.log("🔓 Login exitoso. Bot conectado a Discord."))
  .catch(err => console.error("❌ Error al iniciar sesión:", err));
