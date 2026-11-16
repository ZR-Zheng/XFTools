import 'i18next';

import translation from '../../public/locales/zh/translation.json';
import string from '../../public/locales/zh/string.json';
import number from '../../public/locales/zh/number.json';
import video from '../../public/locales/zh/video.json';
import list from '../../public/locales/zh/list.json';
import json from '../../public/locales/zh/json.json';
import time from '../../public/locales/zh/time.json';
import csv from '../../public/locales/zh/csv.json';
import pdf from '../../public/locales/zh/pdf.json';
import audio from '../../public/locales/zh/audio.json';
import xml from '../../public/locales/zh/xml.json';
import image from '../../public/locales/zh/image.json';
import converters from '../../public/locales/zh/converters.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      translation: typeof translation;
      string: typeof string;
      number: typeof number;
      video: typeof video;
      list: typeof list;
      json: typeof json;
      time: typeof time;
      csv: typeof csv;
      pdf: typeof pdf;
      audio: typeof audio;
      xml: typeof xml;
      image: typeof image;
      converters: typeof converters;
    };
  }
}
