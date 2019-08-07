import { config as dotenvConfig } from "dotenv";
import YouTube from "youtube-node";
dotenvConfig();

const youtube = new (YouTube as any)();
youtube.setKey(process.env.YOUTUBE_KEY);

export default async function search(q: string): Promise<string> {
  return new Promise(function(resolve, reject) {
    const callback: any = async (error: any, result: any) => {
      if (error) {
        if (error.errors) {
          return reject(error.errors[0].message);
        }

        return reject("No videos found.");
      }

      let videoUrl;

      for (const item of result.items) {
        if (item.id.videoId) {
          videoUrl = "https://www.youtube.com/watch?v=" + item.id.videoId;
          break;
        }
      }

      return resolve(videoUrl);
    };

    youtube.search(q, 5, {}, callback);
  });
}
