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

// Servidor web para mantener el bot activo
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('✅ Bot activo y funcionando en Railway!'));

app.listen(PORT, () => {
  console.log(`🌐 Servidor web activo en puerto ${PORT}`);
});

// Crea el cliente
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// Lee las preguntas
const preguntas = JSON.parse(fs.readFileSync("preguntas.json", "utf8"));

// Canal de logs (cambia por el ID real)
const LOG_CHANNEL_ID = "1422893357042110546";

// Categorías (cambia los IDs por los de tu servidor)
const WHITELIST_CATEGORY_ID = "1422897937427464203";
const SOPORTE_CATEGORY_ID = "1422898157829881926";

client.once("ready", () => {
  console.log(`✅ Bot iniciado como: ${client.user.tag}`);
});

// ---- COMANDO !setup-whitelist ----
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!setup-whitelist") || message.author.bot)
    return;

  const embed = new EmbedBuilder()
    .setTitle("📋 Sistema de Whitelist")
    .setDescription(
      "Pulsa el botón para iniciar tu whitelist. Tendra 1 minuto para responder cada pregunta.",
    )
    .setColor("Purple");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("whitelist")
      .setLabel("Iniciar Whitelist")
      .setStyle(ButtonStyle.Primary),
  );

  await message.channel.send({ embeds: [embed], components: [row] });
});

// ---- COMANDO !setup-soporte ----
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

// ---- FUNCIÓN PARA PREGUNTAS ----
async function hacerPregunta(
  channel,
  usuario,
  pregunta,
  index,
  totalPreguntas,
) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("a")
      .setLabel("a")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("b")
      .setLabel("b")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("c")
      .setLabel("c")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("d")
      .setLabel("d")
      .setStyle(ButtonStyle.Secondary),
  );

  // Construimos la descripción de las opciones correctamente
  const opciones = pregunta.opciones
    .map((opcion, index) => {
      const letra = String.fromCharCode(97 + index); // 'a' = 97, 'b' = 98, etc.
      return `${letra}) ${opcion}`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`❓ Pregunta ${index + 1} de ${totalPreguntas}`)
    .setDescription(`**${pregunta.pregunta}**\n\n${opciones}`)
    .setColor("Purple");

  const msg = await channel.send({
    embeds: [embed],
    components: [row],
  });

  return new Promise((resolve) => {
    const filter = (i) => i.user.id === usuario.id;
    channel
      .awaitMessageComponent({ filter, time: 60000 })
      .then(async (interaction) => {
        interaction.deferUpdate().catch(() => {});
        await msg.delete().catch(() => {}); // Eliminar la pregunta después de la respuesta
        resolve(interaction.customId);
      })
      .catch(() => {
        msg.delete().catch(() => {});
        channel.send("⏰ Tiempo agotado, pasamos a la siguiente.");
        resolve(null);
      });
  });
}

// ---- MANEJADOR DE BOTONES ----
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  // --- BOTÓN WHITELIST ---
  if (interaction.customId === "whitelist") {
    const guild = interaction.guild;

    const channel = await guild.channels.create({
      name: `whitelist-${interaction.user.username}`,
      type: 0, // texto
      parent: WHITELIST_CATEGORY_ID, // 👉 lo manda a la categoría de whitelist
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
          ],
        },
      ],
    });

    await interaction.reply({
      content: `✅ Ticket de whitelist creado: ${channel}`,
      flags: 64,
    });

    let puntaje = 0;

    // Hacer las preguntas
    for (let i = 0; i < preguntas.length; i++) {
      const respuesta = await hacerPregunta(
        channel,
        interaction.user,
        preguntas[i],
        i,
        preguntas.length,
      );

      // Comprobar si la respuesta es correcta
      if (respuesta && respuesta === preguntas[i].respuesta) {
        puntaje++;
      }
    }

    // Resultado final en un embed
    const aprobado = puntaje >= 9; // Cambiado a 9 respuestas correctas

    const resultadoEmbed = new EmbedBuilder()
      .setTitle(aprobado ? "✅ Whitelist Aprobada" : "❌ Whitelist Suspendida")
      .setDescription(
        aprobado
          ? `🎉 ¡Felicidades ${interaction.user}, has aprobado la whitelist!\n\n**Puntaje:** ${puntaje}/${preguntas.length}`
          : `😢 Lo sentimos ${interaction.user}, no has aprobado la whitelist.\n\n**Puntaje:** ${puntaje}/${preguntas.length}`,
      )
      .setColor(aprobado ? "Green" : "Red");

    await channel.send({ embeds: [resultadoEmbed] });

    // Si aprueba, asignar rol de whitelist y eliminar el rol de sin whitelist
    if (aprobado) {
      try {
        const member = await guild.members.fetch(interaction.user.id); // Obtener al usuario

        // Asignar el rol de whitelist
        await member.roles.add("822529294365360139"); // Reemplaza con la ID de tu rol de whitelist

        // Eliminar el rol de sin whitelist si lo tiene
        await member.roles.remove("1320037024358600734"); // Reemplaza con la ID de tu rol de sin whitelist

        await channel.send(
          "🎉 ¡Felicidades! Has recibido el rol de **Whitelist**.",
        );
      } catch (err) {
        console.error("❌ Error al asignar o quitar el rol:", err);
        await channel.send(
          "⚠️ Ocurrió un error al asignarte o quitarte el rol, avisa a un staff.",
        );
      }
    }
    // Enviar al canal de logs con mención al usuario
    const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send({
        content: `${interaction.user}`,
        embeds: [resultadoEmbed],
      });
    }

    setTimeout(() => channel.delete().catch(() => {}), 30000);
  }

  // --- BOTÓN SOPORTE ---
  if (interaction.customId === "soporte") {
    const guild = interaction.guild;

    const channel = await guild.channels.create({
      name: `soporte-${interaction.user.username}`,
      type: 0,
      parent: SOPORTE_CATEGORY_ID, // 👉 lo manda a la categoría de soporte
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
          ],
        },
      ],
    });

    await interaction.reply({
      content: `✅ Ticket de soporte creado: ${channel}`,
      flags: 64,
    });
    await channel.send(
      `👋 Hola ${interaction.user}, explica tu problema y un miembro del staff te atenderá.`,
    );
  }
});


// ---- LOGIN ----
client.login(process.env.TOKEN);
