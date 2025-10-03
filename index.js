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
const express = require('express');

// ------------------- Servidor web para mantener vivo ------------------- //
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ Bot activo y funcionando en Railway!'));
app.listen(PORT, () => console.log(`🌐 Servidor web activo en puerto ${PORT}`));

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

// ------------------- Config ------------------- //
const preguntas = JSON.parse(fs.readFileSync("preguntas.json", "utf8"));
const LOG_CHANNEL_ID = "1422893357042110546";           // Canal de logs
const WHITELIST_CATEGORY_ID = "1422897937427464203";    // Categoría whitelist
const SOPORTE_CATEGORY_ID = "1422898157829881926";      // Categoría soporte
const COOLDOWN_HORAS = 6;
const ROLES = {
  whitelist: "822529294365360139",   // Rol de whitelist
  sinWhitelist: "1320037024358600734" // Rol de sin whitelist
};

// ------------------- Cooldowns ------------------- //
const cooldowns = {}; // { userId: timestamp }

// ------------------- READY ------------------- //
client.on("ready", () => {
  console.log(`✅ Bot iniciado como: ${client.user.tag}`);

  // Establecer estado
  client.user.setPresence({
    activities: [{ name: "UNITY CITY 🎮", type: 0 }], // 0 = Playing
    status: "online" // opciones: "online", "idle", "dnd", "invisible"
  });
});


// ------------------- Setup Whitelist ------------------- //
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!setup-whitelist") || message.author.bot)
    return;

  const embed = new EmbedBuilder()
    .setTitle("📋 Sistema de Whitelist")
    .setDescription("Pulsa el botón para iniciar tu whitelist. Tendrás 1 minuto por pregunta.")
    .setColor("Purple");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("whitelist")
      .setLabel("Iniciar Whitelist")
      .setStyle(ButtonStyle.Primary),
  );

  await message.channel.send({ embeds: [embed], components: [row] });
});

// ------------------- Setup Soporte ------------------- //
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!setup-soporte") || message.author.bot)
    return;

  const embed = new EmbedBuilder()
    .setTitle("🎫 Sistema de Soporte")
    .setDescription("Pulsa el botón para abrir un ticket de soporte.")
    .setColor("Green");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("soporte")
      .setLabel("Abrir Ticket de Soporte")
      .setStyle(ButtonStyle.Secondary),
  );

  await message.channel.send({ embeds: [embed], components: [row] });
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Comando para resetear cooldown
  if (message.content.startsWith("!resetcooldown")) {
    // Solo admins pueden usarlo
    if (!message.member.permissions.has("Administrator")) {
      return message.reply("❌ No tienes permisos para usar este comando.");
    }

    // Obtener mención o ID del usuario
    const args = message.content.split(" ");
    const userId = args[1]?.replace(/[<@!>]/g, ""); // elimina caracteres <@!>

    if (!userId || !cooldowns[userId]) {
      return message.reply("❌ Usuario no encontrado o no tiene cooldown.");
    }

    // Eliminar cooldown
    delete cooldowns[userId];
    message.channel.send(`✅ Se ha reseteado el cooldown de <@${userId}>.`);
  }
});


// ------------------- Función hacer pregunta ------------------- //
async function hacerPregunta(channel, usuario, pregunta, index, total) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("a").setLabel("a").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("b").setLabel("b").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("c").setLabel("c").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("d").setLabel("d").setStyle(ButtonStyle.Secondary),
  );

 const opciones = pregunta.opciones
  .map((texto, index) => {
    const letra = String.fromCharCode(97 + index); // 'a', 'b', 'c', 'd'
    return `${letra}) ${texto}`;
  })
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

// ------------------- Manejo de botones ------------------- //
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  // ------------------- WHITELIST ------------------- //
  if (interaction.customId === "whitelist") {
    const userId = interaction.user.id;
    const now = Date.now();

    // Check cooldown
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

    const guild = interaction.guild;

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
      .setDescription(
        aprobado
          ? `🎉 ¡Felicidades ${interaction.user}, has aprobado la whitelist!\n\n**Puntaje:** ${puntaje}/${preguntas.length}`
          : `😢 Lo sentimos ${interaction.user}, no has aprobado la whitelist.\n\n**Puntaje:** ${puntaje}/${preguntas.length}`,
      )
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

    // Log
    const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) logChannel.send({ content: `${interaction.user}`, embeds: [resultadoEmbed] });

    // Cerrar ticket automáticamente
    setTimeout(() => channel.delete().catch(() => {}), 30000);
  }

  // ------------------- SOPORTE ------------------- //
  if (interaction.customId === "soporte") {
    const guild = interaction.guild;
    const channel = await guild.channels.create({
      name: `soporte-${interaction.user.username}`,
      type: 0,
      parent: SOPORTE_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      ],
    });

    // Mencionar al usuario
    const embed = new EmbedBuilder()
      .setTitle("Soporte")
      .setDescription(`**@${interaction.user.username}**, explica tu consulta. El staff te atenderá pronto.`)
      .setImage('URL_DE_LA_IMAGEN') // Reemplaza con la URL de la imagen que desees mostrar
      .setFooter('Paralelo Studios')
      .setColor("Blue")
      .setTimestamp();

    await interaction.reply({ content: `✅ Ticket de soporte creado: ${channel}`, ephemeral: true });
    await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed] });
  }
});

// ------------------- LOGIN ------------------- //
client.login(process.env.TOKEN);
