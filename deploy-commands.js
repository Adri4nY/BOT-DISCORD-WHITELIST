const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require("dotenv").config();

const commands = [
  new SlashCommandBuilder()
    .setName("negocios")
    .setDescription("📋 Enviar formato de solicitud de negocio."),

  new SlashCommandBuilder()
    .setName("streamer")
    .setDescription("🎥 Enviar formato de postulación a streamer."),

  new SlashCommandBuilder()
    .setName("pstaff")
    .setDescription("🛠️ Enviar formato de postulación a staff."),

  new SlashCommandBuilder()
    .setName("setup-soporte")
    .setDescription("⚙️ Configura el sistema de tickets (solo staff)."),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// ⚠️ REEMPLAZA ESTOS IDs CON LOS TUYOS
const CLIENT_ID = "1422713122657140866"; // ID del bot
const GUILD_ID = "821091789325729803";   // ID del servidor

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
})();

