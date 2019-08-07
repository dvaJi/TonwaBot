import Discord, {
  Message,
  Guild,
  Channel,
  VoiceChannel,
  VoiceConnection
} from "discord.js";
import ytdl, { videoFormat } from "ytdl-core";
import { config as dotenvConfig } from "dotenv";

import isUrl from "./utils/is-url";
import searchVideo from "./utils/search-video";

dotenvConfig();

interface ISong {
  title: string;
  url: string;
}

interface IQueueConst {
  textChannel: Channel;
  voiceChannel: VoiceChannel;
  connection: VoiceConnection | null;
  songs: ISong[];
  volume: number;
  playing: boolean;
}

const prefix = "!w";

const client = new Discord.Client();

const queue = new Map();

client.once("ready", () => {
  console.log("Ready!");
});

client.once("reconnecting", () => {
  console.log("Reconnecting!");
});

client.once("disconnect", () => {
  console.log("Disconnect!");
});

client.on("message", async (message: Message) => {
  if (message.author.bot) {
    return;
  }
  if (!message.content.startsWith(prefix)) {
    return;
  }

  const serverQueue = queue.get(message.guild.id);

  if (message.content.startsWith(`${prefix}play`)) {
    execute(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}skip`)) {
    skip(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}stop`)) {
    stop(message, serverQueue);
    return;
  } else {
    message.channel.send("You need to enter a valid command!");
  }
});

async function execute(message: Message, serverQueue: any) {
  const args = message.content.split(" ");

  const voiceChannel = message.member.voiceChannel;
  if (!voiceChannel) {
    return message.channel.send(
      "You need to be in a voice channel to play music!"
    );
  }
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions) {
    console.log("Need permissions");
    return;
  }

  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "I need the permissions to join and speak in your voice channel!"
    );
  }

  let videoUrl = "";
  if (isUrl(args[1])) {
    videoUrl = args[1];
  } else {
    const searchWord = message.content.replace(`${prefix} `, "");
    videoUrl = await searchVideo(searchWord);
  }

  const songInfo = await ytdl.getInfo(videoUrl);
  const song: ISong = {
    title: songInfo.title,
    url: songInfo.video_url
  };

  if (!serverQueue) {
    const queueContruct: IQueueConst = {
      textChannel: message.channel,
      voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true
    };

    queue.set(message.guild.id, queueContruct);

    queueContruct.songs.push(song);

    try {
      const connection = await voiceChannel.join();
      queueContruct.connection = connection;
      play(message.guild, queueContruct.songs[0]);
      return message.channel.send(`${song.title} has been added to the queue!`);
    } catch (err) {
      console.log(err);
      queue.delete(message.guild.id);
      return message.channel.send(err);
    }
  } else {
    serverQueue.songs.push(song);
    console.log(serverQueue.songs);
    return message.channel.send(`${song.title} has been added to the queue!`);
  }
}

function skip(message: Message, serverQueue: any) {
  if (!message.member.voiceChannel) {
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
  }
  if (!serverQueue) {
    return message.channel.send("There is no song that I could skip!");
  }
  serverQueue.connection.dispatcher.end();
}

function stop(message: Message, serverQueue: any) {
  if (!message.member.voiceChannel) {
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
  }
  serverQueue.songs = [];
  serverQueue.connection.dispatcher.end();
}

function play(guild: Guild, song: ISong) {
  const serverQueue = queue.get(guild.id);

  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }

  const dispatcher = serverQueue.connection
    .playStream(
      ytdl(song.url, {
        filter: (format: videoFormat) => {
          return format.container === "mp4" && format.audioEncoding != null;
        },
        quality: "highest"
      })
    )
    .on("end", () => {
      console.log("Music ended!");
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", (error: Error) => {
      console.error(error);
    });
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}

client.login(process.env.BOT_TOKEN);
