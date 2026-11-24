import 'i18next';

import translation from '../../public/locales/zh/translation.json';
import video from '../../public/locales/zh/video.json';
import time from '../../public/locales/zh/time.json';
import pdf from '../../public/locales/zh/pdf.json';
import audio from '../../public/locales/zh/audio.json';
import image from '../../public/locales/zh/image.json';
import converters from '../../public/locales/zh/converters.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      translation: typeof translation;
      video: typeof video;
      time: typeof time;
      pdf: typeof pdf;
      audio: typeof audio;
      image: typeof image;
      converters: typeof converters;
    };
  }
}
