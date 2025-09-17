import { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, REST, Routes, SlashCommandBuilder } from "discord.js";
import cron from "node-cron";
import express from "express";
import { CONFIG } from "./config.js";

const TOKEN = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000; // Render provides PORT environment variable
const { GUILD_ID, ROLE_ID, CHANNEL_ID, EVENTS_CHANNEL_URL, EVENTS } = CONFIG;
const registrations = {};

// ---------- Discord client ----------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// ---------- Express server to stay online ----------
const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
app.listen(PORT, () => console.log(`Server is live on port ${PORT}`));

// ---------- Register slash commands ----------
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("previeweventmessage")
      .setDescription("Preview the event embed and buttons")
      .addStringOption(option =>
        option.setName("event")
          .setDescription("Choose an event to preview")
          .setRequired(true)
          .addChoices(
            { name: "Harbor", value: "Harbor" },
            { name: "RP Ticket Factory", value: "RP Ticket Factory" },
            { name: "Weapons Factory", value: "Weapons Factory" },
            { name: "Shopping Center", value: "Shopping Center" }
          )
      )
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });

  console.log("Slash commands registered.");

  // ---------- Schedule events ----------
  for (const [eventName, times] of Object.entries(EVENTS)) {
    for (const timeStr of times) {
      let [hour, minute] = timeStr.split(":").map(Number);
      minute -= 10;
      if (minute < 0) {
        minute += 60;
        hour -= 1;
      }
      if (hour < 0) hour += 24;

      cron.schedule(`${minute} ${hour} * * *`, async () => {
        const guild = await client.guilds.fetch(GUILD_ID);
        const channel = guild.channels.cache.get(CHANNEL_ID);
        const role = guild.roles.cache.get(ROLE_ID);
        if (!channel || !role) return;

        registrations[eventName] = registrations[eventName] || [];

        const embed = createEventEmbed(eventName, timeStr); // pass original start time
        const row = createButtonRow(eventName);

        await channel.send({ content: `${role}`, embeds: [embed], components: [row] });
      }, { timezone: "Europe/London" });
    }
  }

  console.log("Event scheduler started!");
});

// ---------- Button interactions ----------
client.on("interactionCreate", async interaction => {
  if (interaction.isButton()) {
    const [action, eventName] = interaction.customId.split("_");
    registrations[eventName] = registrations[eventName] || [];

    if (action === "register") {
      if (!registrations[eventName].includes(interaction.user.username)) {
        registrations[eventName].push(interaction.user.username);
        await interaction.reply({ content: `✅ You have been registered for **${eventName}**!`, ephemeral: true });
      } else {
        await interaction.reply({ content: `⚠️ You are already registered for **${eventName}**!`, ephemeral: true });
      }
    } else if (action === "show") {
      await interaction.reply({ 
        content: `📋 Registered participants for **${eventName}**:\n${registrations[eventName].length ? registrations[eventName].join("\n") : "None yet"}`, 
        ephemeral: true 
      });
    }
  } else if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "previeweventmessage") {
      const eventName = interaction.options.getString("event");
      registrations[eventName] = registrations[eventName] || [];

      const embed = createEventEmbed(eventName, "??:??"); // preview doesn't know real time, placeholder
      const row = createButtonRow(eventName);

      await interaction.reply({ content: "Preview:", embeds: [embed], components: [row], ephemeral: true });
    }
  }
});

// ---------- Helper functions ----------
function createEventEmbed(eventName, startTime) {
  return new EmbedBuilder()
    .setTitle(`💎 ${eventName}`)
    .setDescription(
      `🔹Event Starts in **10 minutes**\n` +
      `🔹Start Time: **${startTime} (In Game)**\n\n` +
      `🔹Click below to **register** or **view registered players**`
    )
    .setColor(0x00ddff)
    .setThumbnail("https://raw.githubusercontent.com/CodingWithCrystaL/dior-family/refs/heads/main/file_00000000810061fba1eb3f3e52f6e605.jpeg")
    .setImage("https://raw.githubusercontent.com/CodingWithCrystaL/dior-family/refs/heads/main/standard.gif")
    .setTimestamp();
}

function createButtonRow(eventName) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel("Event Info")
        .setStyle(ButtonStyle.Link)
        .setURL(EVENTS_CHANNEL_URL),
      new ButtonBuilder()
        .setCustomId(`register_${eventName}`)
        .setLabel("Register Yourself")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`show_${eventName}`)
        .setLabel("Show Registered")
        .setStyle(ButtonStyle.Secondary)
    );
}

// ---------- Login ----------
client.login(TOKEN);
