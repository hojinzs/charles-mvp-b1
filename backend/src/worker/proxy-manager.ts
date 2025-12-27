import { v4 as uuidv4 } from "uuid";

interface ProxyConfig {
  host: string;
  port: number;
}

interface ProxyCredentials {
  username: string;
  password?: string;
}

export class ProxyManager {
  private static instance: ProxyManager;
  private currentSessionId: string = "";
  private rotationInterval: NodeJS.Timeout | null = null;
  private isEnabled: boolean = true;

  // Loaded from env
  private readonly HOST = process.env.PROXY_HOST;
  private readonly PORT = process.env.PROXY_PORT
    ? parseInt(process.env.PROXY_PORT, 10)
    : 0;
  private readonly USER = process.env.PROXY_USER;
  private readonly PASS = process.env.PROXY_PASS;

  private constructor() {
    this.rotateSession();
    this.startRotation();
  }

  public static getInstance(): ProxyManager {
    if (!ProxyManager.instance) {
      ProxyManager.instance = new ProxyManager();
    }
    return ProxyManager.instance;
  }

  public rotateSession() {
    this.currentSessionId = uuidv4();
    console.log(`[ProxyManager] Rotated session to: ${this.currentSessionId}`);
  }

  private startRotation() {
    // 30 minutes
    const INTERVAL_MS = 30 * 60 * 1000;
    if (this.rotationInterval) clearInterval(this.rotationInterval);
    this.rotationInterval = setInterval(() => {
      this.rotateSession();
    }, INTERVAL_MS);
  }

  /**
   * Returns valid proxy host/port only if configured effectively.
   */
  public getProxyServer(): ProxyConfig | null {
    if (!this.HOST || !this.PORT || !this.USER) {
      return null;
    }

    // If user explicitly asks for no proxy control via some env, we could handle it here.
    return {
      host: this.HOST,
      port: this.PORT,
    };
  }

  /**
   * Returns credentials with the current session ID embedded in the username.
   */
  public getProxyCredentials(): ProxyCredentials | null {
    if (!this.USER) return null;

    // BrightData format: user-session-ID
    const usernameWithSession = `${this.USER}-session-${this.currentSessionId}`;

    return {
      username: usernameWithSession,
      password: this.PASS,
    };
  }
}
