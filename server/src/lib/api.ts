import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

import Clip from './clip';
import Prometheus from './prometheus';
import WebHook from './webhook';
import respond from './responder';

const Random = require('random-js');

const SENTENCE_FOLDER = '../../data/';

export default class API {
  clip: Clip;
  metrics: Prometheus;
  sentencesCache: String[];
  webhook: WebHook;
  randomEngine: any;

  constructor() {
    this.clip = new Clip();
    this.metrics = new Prometheus();
    this.webhook = new WebHook();
    this.getSentences();
    this.randomEngine = Random.engines.mt19937();
    this.randomEngine.autoSeed();
  }

  /**
   * Loads cache. API will still be responsive to requests while loading cache.
   */
  async init(): Promise<void> {
    await this.clip.init();
  }

  private getSentenceFolder() {
    return path.join(__dirname, SENTENCE_FOLDER);
  }

  private getRandomSentences(count: number): Promise<string[]> {
    return this.getSentences().then((sentences: string[]) => {
      let randoms = [];
      for (var i = 0; i < count; i++) {
        let distribution = Random.integer(0, sentences.length - 1);
        let randomIndex = distribution(this.randomEngine);
        randoms.push(sentences[randomIndex]);
      }
      return randoms;
    });
  }

  private getFilesInFolder(folderpath: string) {
    return new Promise(
      (res: (files: string[]) => void, rej: (error: any) => void) => {
        fs.readdir(folderpath, (err: any, files: string[]) => {
          if (err) {
            rej(err);
            return;
          }

          res(files);
        });
      }
    );
  }

  private getFileContents(filepath: string) {
    return new Promise(
      (res: (contents: string) => void, rej: (error: any) => void) => {
        fs.readFile(filepath, 'utf8', (err: any, data: string) => {
          if (err) {
            rej(err);
            return;
          }

          res(data);
        });
      }
    );
  }
  /**
   * Is this request directed at the api?
   */
  isApiRequest(request: http.IncomingMessage) {
    return (
      request.url.includes('/api/') ||
      this.clip.isClipRequest(request) ||
      this.metrics.isPrometheusRequest(request)
    );
  }

  /**
   * Give api response.
   */
  handleRequest(request: http.IncomingMessage, response: http.ServerResponse) {
    this.metrics.countRequest(request);

    // Handle all clip related requests first.
    if (this.clip.isClipRequest(request)) {
      this.metrics.countClipRequest(request);
      this.clip.handleRequest(request, response);
      return;
    }

    // Check for Prometheus metrics request.
    if (this.metrics.isPrometheusRequest(request)) {
      this.metrics.countPrometheusRequest(request);
      this.metrics.handleRequest(request, response);
      return;
    }

    // If we get here, we are at an API request.
    this.metrics.countApiRequest(request);

    // Most often this will be a sentence request.
    if (request.url.includes('/sentence')) {
      let parts = request.url.split('/');
      let index = parts.indexOf('sentence');
      let count = parts[index + 1] && parseInt(parts[index + 1], 10);
      this.returnRandomSentence(response, count);
      // Webhooks from github.
    } else if (this.webhook.isHookRequest(request)) {
      this.webhook.handleWebhookRequest(request, response);

      // Unrecognized requests get here.
    } else {
      console.error('unrecongized api url', request.url);
      respond(response, "I'm not sure what you want.", 404);
    }
  }

  getSentences(): Promise<any> {
    if (this.sentencesCache) {
      return Promise.resolve(this.sentencesCache);
    }

    return (
      this.getFilesInFolder(this.getSentenceFolder())
        .then((files: string[]) => {
          return Promise.all(
            files.map(filename => {
              // Only parse the top-level text files, not any sub folders.
              if (filename.split('.').pop() !== 'txt') {
                return null;
              }

              let filepath = path.join(this.getSentenceFolder(), filename);
              return this.getFileContents(filepath);
            })
          );
        })
        // Chop the array of content strings into an array of sentences.
        .then((values: string[]) => {
          let sentences: string[] = [];
          let sentenceArrays = values.map(fileContents => {
            if (!fileContents) {
              return [];
            }

            // Remove any blank line sentences.
            let fileSentences = fileContents.split('\n');
            return fileSentences.filter(sentence => {
              return !!sentence;
            });
          });

          sentences = sentences.concat.apply(sentences, sentenceArrays);
          console.log('sentences found', sentences.length);
          this.sentencesCache = sentences;
        })
        .catch((err: any) => {
          console.error('could not retrieve sentences', err);
        })
    );
  }

  /**
   * Load sentence file (if necessary), pick random sentence.
   */
  returnRandomSentence(response: http.ServerResponse, count: number) {
    count = count || 1;

    this.getSentences()
      .then((sentences: String[]) => {
        return this.getRandomSentences(count);
      })
      .then((randoms: string[]) => {
        respond(response, randoms.join('\n'));
      })
      .catch((err: any) => {
        console.error('Could not load sentences', err);
        respond(response, 'No sentences right now', 500);
      });
  }
}
