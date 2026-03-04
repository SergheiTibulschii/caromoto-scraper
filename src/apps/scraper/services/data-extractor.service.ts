import { Page } from 'playwright';
import { ExtractorConfig, ExtractedDataResult } from '../types';
import LoggerService from '../../../common/shared/services/logger.service';

export class DataExtractorService {
  private logger: LoggerService;

  constructor() {
    this.logger = LoggerService.getInstance();
  }

  public async extractData(
    page: Page,
    extractors: Record<string, string | ExtractorConfig>,
  ): Promise<ExtractedDataResult> {
    try {
      const data: Record<string, any> = {};

      for (const [key, config] of Object.entries(extractors)) {
        try {
          if (typeof config === 'string') {
            data[key] = await this.extractText(page, config);
          } else {
            data[key] = await this.extractWithConfig(page, config);
          }
        } catch (error) {
          this.logger.warn(
            `Failed to extract data for key "${key}": ${(error as Error).message}`,
          );
          data[key] = null;
        }
      }

      return { success: true, data };
    } catch (error) {
      this.logger.error('Data extraction failed', error as Error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private async extractText(page: Page, selector: string): Promise<string> {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    const text = await element.textContent();
    return text?.trim() || '';
  }

  private async extractWithConfig(
    page: Page,
    config: ExtractorConfig,
  ): Promise<any> {
    const { selector, type = 'text', attribute, transform } = config;

    switch (type) {
      case 'text':
        return this.extractTextContent(page, selector, transform);

      case 'html':
        return this.extractHtml(page, selector, transform);

      case 'attribute':
        if (!attribute) {
          throw new Error(
            'Attribute name is required for attribute extraction',
          );
        }
        return this.extractAttribute(page, selector, attribute, transform);

      case 'multiple':
        return this.extractMultiple(page, selector, attribute, transform);

      default:
        throw new Error(`Unknown extraction type: ${type}`);
    }
  }

  private async extractTextContent(
    page: Page,
    selector: string,
    transform?: (value: string) => any,
  ): Promise<string> {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const text = await element.textContent();
    const trimmedText = text?.trim() || '';

    return transform ? transform(trimmedText) : trimmedText;
  }

  private async extractHtml(
    page: Page,
    selector: string,
    transform?: (value: string) => any,
  ): Promise<string> {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const html = await element.innerHTML();
    return transform ? transform(html) : html;
  }

  private async extractAttribute(
    page: Page,
    selector: string,
    attribute: string,
    transform?: (value: string) => any,
  ): Promise<string> {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const value = await element.getAttribute(attribute);
    if (value === null) {
      throw new Error(
        `Attribute "${attribute}" not found on element: ${selector}`,
      );
    }

    return transform ? transform(value) : value;
  }

  private async extractMultiple(
    page: Page,
    selector: string,
    attribute?: string,
    transform?: (value: string) => any,
  ): Promise<any[]> {
    const elements = await page.$$(selector);
    if (elements.length === 0) {
      this.logger.warn(`No elements found for selector: ${selector}`);
      return [];
    }

    const results: any[] = [];

    for (const element of elements) {
      try {
        let value: string | null;

        if (attribute) {
          value = await element.getAttribute(attribute);
        } else {
          value = await element.textContent();
        }

        if (value !== null) {
          const processedValue = value.trim();
          results.push(transform ? transform(processedValue) : processedValue);
        }
      } catch (error) {
        this.logger.warn(
          `Error extracting from element: ${(error as Error).message}`,
        );
      }
    }

    return results;
  }

  public async extractStructuredData(
    page: Page,
    schema: Record<string, any>,
  ): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    for (const [key, config] of Object.entries(schema)) {
      if (typeof config === 'object' && !config.selector) {
        result[key] = await this.extractStructuredData(page, config);
      } else {
        try {
          if (typeof config === 'string') {
            result[key] = await this.extractText(page, config);
          } else {
            result[key] = await this.extractWithConfig(page, config);
          }
        } catch (error) {
          this.logger.warn(
            `Failed to extract "${key}": ${(error as Error).message}`,
          );
          result[key] = null;
        }
      }
    }

    return result;
  }

  public async extractTable(
    page: Page,
    tableSelector: string,
  ): Promise<Array<Record<string, string>>> {
    try {
      const table = await page.$(tableSelector);
      if (!table) {
        throw new Error(`Table not found: ${tableSelector}`);
      }

      const headers = await table.$$eval('thead th, thead td', (cells) =>
        cells.map((cell) => cell.textContent?.trim() || ''),
      );

      const rows = await table.$$('tbody tr');
      const data: Array<Record<string, string>> = [];

      for (const row of rows) {
        const cells = await row.$$eval('td', (cells) =>
          cells.map((cell) => cell.textContent?.trim() || ''),
        );

        const rowData: Record<string, string> = {};
        headers.forEach((header, index) => {
          rowData[header] = cells[index] || '';
        });

        data.push(rowData);
      }

      return data;
    } catch (error) {
      this.logger.error('Table extraction failed', error as Error);
      throw error;
    }
  }

  public async extractLinks(
    page: Page,
    selector = 'a',
  ): Promise<Array<{ text: string; href: string }>> {
    try {
      const links = await page.$$eval(selector, (anchors) =>
        anchors.map((a) => ({
          text: a.textContent?.trim() || '',
          href: (a as HTMLAnchorElement).href || '',
        })),
      );

      return links.filter((link) => link.href);
    } catch (error) {
      this.logger.error('Link extraction failed', error as Error);
      return [];
    }
  }

  public async extractImages(
    page: Page,
    selector = 'img',
  ): Promise<Array<{ alt: string; src: string }>> {
    try {
      const images = await page.$$eval(selector, (imgs) =>
        imgs.map((img) => ({
          alt: (img as HTMLImageElement).alt || '',
          src: (img as HTMLImageElement).src || '',
        })),
      );

      return images.filter((img) => img.src);
    } catch (error) {
      this.logger.error('Image extraction failed', error as Error);
      return [];
    }
  }

  public async extractMetadata(page: Page): Promise<Record<string, string>> {
    try {
      const metadata: Record<string, string> = {};

      const title = await page.title();
      metadata.title = title;

      const metaTags = await page.$$eval('meta', (metas) =>
        metas.map((meta) => ({
          name: meta.getAttribute('name') || meta.getAttribute('property'),
          content: meta.getAttribute('content'),
        })),
      );

      for (const tag of metaTags) {
        if (tag.name && tag.content) {
          metadata[tag.name] = tag.content;
        }
      }

      const canonicalLink = await page
        .$eval(
          'link[rel="canonical"]',
          (link) => (link as HTMLLinkElement).href,
        )
        .catch(() => null);

      if (canonicalLink) {
        metadata.canonical = canonicalLink;
      }

      return metadata;
    } catch (error) {
      this.logger.error('Metadata extraction failed', error as Error);
      return {};
    }
  }

  public async waitForDynamicContent(
    page: Page,
    selector: string,
    options?: {
      timeout?: number;
      state?: 'attached' | 'detached' | 'visible' | 'hidden';
    },
  ): Promise<void> {
    try {
      await page.waitForSelector(selector, {
        timeout: options?.timeout || 10000,
        state: options?.state || 'visible',
      });
    } catch (error) {
      this.logger.error(
        `Timeout waiting for selector: ${selector}`,
        error as Error,
      );
      throw error;
    }
  }

  public async extractJson(page: Page, selector: string): Promise<any | null> {
    try {
      const element = await page.$(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      const jsonText = await element.textContent();
      if (!jsonText) {
        return null;
      }

      return JSON.parse(jsonText);
    } catch (error) {
      this.logger.error('JSON extraction failed', error as Error);
      return null;
    }
  }
}

export default DataExtractorService;
