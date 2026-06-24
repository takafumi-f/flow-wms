import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import type { UserRole } from '@/types';

// NextAuth v5 セッション型拡張
declare module 'next-auth' {
  interface User {
    id: string;
    tenantId: string;
    warehouseId: string | null;
    role: UserRole;
  }
  interface Session {
    user: {
      id: string;
      tenantId: string;
      warehouseId: string | null;
      name: string;
      email: string;
      role: UserRole;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    tenantId: string;
    warehouseId: string | null;
    role: UserRole;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // DBは動的インポートでクライアントサイドでのエラーを回避
        const { default: sql } = await import('@/lib/db');

        const [user] = await sql`
          SELECT u.id, u.tenant_id, u.warehouse_id, u.email,
                 u.password_hash, u.name, u.role, u.is_active
          FROM users u
          WHERE u.email = ${credentials.email as string}
            AND u.is_active = true
          LIMIT 1
        `;

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash as string,
        );
        if (!isValid) return null;

        // last_login_at を更新
        await sql`
          UPDATE users SET last_login_at = NOW() WHERE id = ${user.id as string}
        `;

        return {
          id: user.id as string,
          tenantId: user.tenant_id as string,
          warehouseId: user.warehouse_id as string | null,
          name: user.name as string,
          email: user.email as string,
          role: user.role as UserRole,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId;
        token.warehouseId = user.warehouseId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.tenantId = token.tenantId;
      session.user.warehouseId = token.warehouseId;
      session.user.role = token.role;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
