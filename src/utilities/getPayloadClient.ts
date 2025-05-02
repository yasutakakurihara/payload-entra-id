// getPayloadClient.ts
import dotenv from 'dotenv';
import path from 'path';
import { Payload } from 'payload';
import payload from 'payload'; 
import config from '../payload.config';

// 環境変数の読み込み
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

// グローバルキャッシュの設定
let cached = (global as any).payload;

if (!cached) {
  cached = (global as any).payload = { 
    client: null, 
    promise: null 
  };
}

// Payloadクライアントの取得
export const getPayloadClient = async (): Promise<Payload> => {
  if (cached.client) {
    return cached.client;
  }

  if (!cached.promise) {
    cached.promise = payload.init({
      config,
    });
  }

  try {
    cached.client = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.client;
};
