import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const nodeEnv = configService.get<string>('NODE_ENV');
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret && nodeEnv === 'production') {
      throw new Error(
        'CRÍTICO: A variável de ambiente JWT_SECRET deve ser configurada em produção.',
      );
    }

    const secretOrKey =
      secret ?? 'super_secret_jwt_key_runmanager_ulbra_2026';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Token de autenticação inválido.');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
