export interface ISecretRedactor {
  redact(content: string): string;
  redactObject<T>(obj: T): T;
}
