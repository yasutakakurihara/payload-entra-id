'use server'

import { getPayload, buildConfig } from 'payload'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { authenticated } from '../../access/authenticated'
import { Profile } from 'next-auth'

interface SignInUser {
  id?: string | undefined
  email?: string | null
  name?: string | null
}

/**
 * ユーザーをPayloadデータベースと同期するサーバーアクション
 */
export async function syncUserWithPayload(user: SignInUser, profile?:Profile): Promise<boolean> {
  try {
    const payload = await getPayload({
      config: buildConfig({
        serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || '',
        collections: [{
          slug: 'users',
          auth: true,
          access: {
            admin: authenticated,
            create: authenticated,
            delete: authenticated,
            read: authenticated,
            update: authenticated,
          },
          admin: {
            defaultColumns: ['name', 'email'],
            useAsTitle: 'name',
          },
          fields: [
            {
              name: 'name',
              type: 'text',
            },
            {
              name: 'email',
              type: 'text',
            },
            {
              name: 'role',
              type: 'select',
              defaultValue: 'user',
              options: [
                {
                  label: 'User',
                  value: 'user',
                },
                {
                  label: 'Admin',
                  value: 'admin',
                },
              ],
            },
          ],
          timestamps: true,
        }],
        db: (process.env.SKIP_DB_CONNECTION === 'true' 
          ? undefined 
          : mongooseAdapter({
              url: process.env.DATABASE_URI || '',
            })) as any,        
        secret: process.env.PAYLOAD_SECRET || '',
      }),
    })
    
    // ユーザーがPayloadのデータベースに存在するか確認
    const { docs: existingUsers } = await payload.find({
      collection: 'users',
      where: {
        id: {
          equals: user.id,
        },
      },
    });
    const existingUser = existingUsers[0];
    
    if (!existingUser) {
      // ユーザーが存在しない場合は作成
      console.log('新規ユーザーを作成:', { email: user.email, name: user.name });
      await payload.create({
        collection: 'users',
        data: {
          id: profile?.oid as string,
          email: user.email ?? 'unknown@example.com',
          name: user.name ?? 'Unknown User',
          role: 'admin',
        },
      });
    } else {
      // 既存ユーザーの情報を更新
      console.log('既存ユーザーを更新:', { id: existingUser.id, email: existingUser.email });
      // await payload.update({
      //   collection: 'users',
      //   id: existingUser.id,
      //   data: {
      //     id: profile?.oid as string,
      //     name: user.name ?? 'Unknown User',
      //     role: 'admin',
      //   },
      // });
    }

    return true;
  } catch (error) {
    console.error('Error syncing user with Payload:', error);
    return true; // エラーがあっても認証は許可
  }
}
