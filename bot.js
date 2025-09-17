import { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import cron from "node-cron";
import { CONFIG } from "./config.js";

// Read token from hosting environment variable
const TOKEN = process.env.DISCORD_TOKEN;

// Destructure config
const { GUILD_ID, ROLE_ID, CHANNEL_ID, EVENTS_CHANNEL_URL, EVENTS } = CONFIG;

// In-memory registrations
const registrations = {};

// Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Bot ready
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Schedule each event
  for (const [eventName, times] of Object.entries(EVENTS)) {
    for (const timeStr of times) {
      let [hour, minute] = timeStr.split(":").map(Number);

      // Trigger 10 minutes before event
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

        // Create embed
        const embed = new EmbedBuilder()
          .setTitle(`${eventName} starts in 10 minutes!`)
          .setDescription(`Click the buttons below to register or get more info.`)
          .setColor(0x00ddff)
          .addFields({ 
            name: "Registered Participants", 
            value: registrations[eventName].length ? registrations[eventName].join("\n") : "None yet" 
          })
          .setThumbnail("https://raw.githubusercontent.com/CodingWithCrystaL/dior-family/refs/heads/main/file_00000000810061fba1eb3f3e52f6e605.jpeg")
          .setImage("https://raw.githubusercontent.com/CodingWithCrystaL/dior-family/refs/heads/main/standard.gif")
          .setTimestamp();

        // Buttons
        const row = new ActionRowBuilder()
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

        // Send message
        await channel.send({ content: `${role}`, embeds: [embed], components: [row] });
      }, { timezone: "Europe/London" });
    }
  }

  console.log("Event scheduler started!");
});

// Button interactions
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

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
});

// Login
client.login(TOKEN);
