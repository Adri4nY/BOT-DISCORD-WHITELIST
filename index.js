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
  Routes
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

// ------------------- Evento Ready ------------------- //
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
    new SlashCommandBuilder() // NUEVO
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

    // ---- Comando /reset-whitelist ---- // NUEVO
    if (interaction.isChatInputCommand() && interaction.commandName === "reset-whitelist") {
      const member = await guild.members.fetch(interaction.user.id);
      const allowedRoles = [MOD_ROLES.admin, MOD_ROLES.moderador, MOD_ROLES.soporte];

      if (!allowedRoles.some(role => member.roles.cache.has(role))) {
        return interaction.reply({ content: "❌ No tienes permiso para usar este comando.", ephemeral: true });
      }

      const target = interaction.options.getUser("usuario");
      if (!target) return interaction.reply({ content: "⚠️ Usuario no válido.", ephemeral: true });

      if (!cooldowns.has(target.id)) {
        return interaction.reply({ content: `ℹ️ ${target.username} no tiene cooldown activo.`, ephemeral: true });
      }

      cooldowns.delete(target.id);
      interaction.reply({ content: `✅ Se ha reseteado la whitelist de ${target.username}. Ahora puede volver a intentarla sin esperar.`, ephemeral: true });
    }

    // ---- Setup Soporte ----
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
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          // NUEVO: permitir ver al staff
          { id: MOD_ROLES.moderador, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: MOD_ROLES.soporte, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: MOD_ROLES.admin, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ],
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
      setTimeout(() => interaction.channel?.delete().catch(() => {}), 5000);
    }

    // ---- Botón Whitelist ----
    if (interaction.isButton() && interaction.customId === "whitelist") {
      const userId = interaction.user.id;
      const now = Date.now();

      if (cooldowns.has(userId) && now - cooldowns.get(userId) < COOLDOWN_HORAS * 60 * 60 * 1000) {
        const remaining = COOLDOWN_HORAS * 60 * 60 * 1000 - (now - cooldowns.get(userId));
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

        return interaction.reply({
          content: `⚠️ Ya hiciste un intento de whitelist. Debes esperar ${hours}h ${minutes}m antes de intentarlo de nuevo.`,
          ephemeral: true,
        });
      }

      cooldowns.set(userId, now);

      const channel = await guild.channels.create({
        name: `whitelist-${interaction.user.username}`,
        type: 0,
        parent: WHITELIST_CATEGORY_ID,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          // NUEVO: permitir ver al staff
          { id: MOD_ROLES.moderador, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: MOD_ROLES.soporte, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: MOD_ROLES.admin, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
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

  } catch (error) {
    console.error("❌ Error en interactionCreate:", error);
    if (interaction.replied || interaction.deferred) {
      interaction.followUp({ content: "⚠️ Ocurrió un error al procesar tu interacción.", ephemeral: true }).catch(() => {});
    } else {
      interaction.reply({ content: "⚠️ Ocurrió un error al procesar tu interacción.", ephemeral: true }).catch(() => {});
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
