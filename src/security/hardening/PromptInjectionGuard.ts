export interface InjectionSanitizationResult {
  readonly isClean: boolean;
  readonly detectedPatterns: readonly string[];
  readonly neutralizedText: string;
}

export class PromptInjectionGuard {
  private static readonly INJECTION_PATTERNS: Array<{ name: string; regex: RegExp }> = [
    {
      name: 'SYSTEM_PROMPT_OVERRIDE',
      regex: /(?:ignore|disregard|override|bypass)\s+(?:all\s+)?(?:previous|system|security|established)\s+(?:instructions|rules|prompts|guidelines)/gi,
    },
    {
      name: 'PRIVILEGE_ESCALATION_DIRECTIVE',
      regex: /(?:you\s+are\s+now|grant|assume\s+the\s+role\s+of)\s+(?:an?\s+)?(?:admin|administrator|root|superuser|system\s+user)/gi,
    },
    {
      name: 'CREDENTIAL_EXFILTRATION_DIRECTIVE',
      regex: /(?:reveal|print|output|dump|exfiltrate|leak)\s+(?:all\s+)?(?:credentials|secrets|api\s*keys|tokens|passwords|env(?:ironment)?\s*vars)/gi,
    },
    {
      name: 'COMMAND_EXECUTION_DIRECTIVE',
      regex: /(?:execute|run|eval)\s+(?:arbitrary|system|bash|shell|powershell|cmd)\s+(?:command|script)/gi,
    },
  ];

  /**
   * Scans untrusted input for prompt injection attack patterns.
   * If detected, flags the text and neutralizes active attack directives.
   */
  public static scanAndNeutralize(text: string): InjectionSanitizationResult {
    if (!text || typeof text !== 'string') {
      return { isClean: true, detectedPatterns: [], neutralizedText: text };
    }

    const detectedPatterns: string[] = [];
    let neutralized = text;

    for (const { name, regex } of this.INJECTION_PATTERNS) {
      const re = new RegExp(regex.source, regex.flags);
      if (re.test(text)) {
        detectedPatterns.push(name);
        // Replace hostile instructions with benign marked tokens
        neutralized = neutralized.replace(re, `[BLOCKED_PROMPT_INJECTION_DIRECTIVE:${name}]`);
      }
    }

    return {
      isClean: detectedPatterns.length === 0,
      detectedPatterns,
      neutralizedText: neutralized,
    };
  }

  /**
   * Wraps untrusted repository content inside an immutable structural boundary,
   * instructing downstream LLM systems that enclosed content is inert data.
   */
  public static wrapAsUntrustedData(content: string, sourceLabel: string = 'repository_content'): string {
    const { neutralizedText } = this.scanAndNeutralize(content);
    return `<untrusted_content source="${sourceLabel}" classification="DATA">\n${neutralizedText}\n</untrusted_content>`;
  }
}
