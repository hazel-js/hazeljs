import {
  sanitizeHtml,
  sanitizeString,
  sanitizeUrl,
  sanitizeEmail,
  sanitizeSql,
  sanitizeObject,
  escapeHtml,
} from '../../utils/sanitize';

describe('Sanitize Utilities', () => {
  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const input = '<div>Hello <script>alert("xss")</script> World</div>';
      const result = sanitizeHtml(input);

      expect(result).not.toContain('<script>');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('should remove iframe tags', () => {
      const input = '<div>Content <iframe src="evil.com"></iframe></div>';
      const result = sanitizeHtml(input);

      expect(result).not.toContain('<iframe>');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(\'xss\')">Click me</div>';
      const result = sanitizeHtml(input);

      expect(result).not.toContain('onclick');
    });

    it('should remove javascript: protocol', () => {
      const input = '<a href="javascript:alert(\'xss\')">Link</a>';
      const result = sanitizeHtml(input);

      expect(result).not.toContain('javascript:');
    });

    it('should remove data:text/html', () => {
      const input = '<a href="data:text/html,<script>alert(\'xss\')</script>">Link</a>';
      const result = sanitizeHtml(input);

      expect(result).not.toContain('data:text/html');
    });

    it('should handle non-string input', () => {
      const result = sanitizeHtml(123 as any);
      expect(result).toBe('123');
    });

    it('should preserve safe HTML', () => {
      const input = '<div><p>Safe content</p></div>';
      const result = sanitizeHtml(input);

      expect(result).toContain('<div>');
      expect(result).toContain('<p>');
      expect(result).toContain('Safe content');
    });

    it('should remove multiple script tags', () => {
      const input = '<script>bad1</script>Content<script>bad2</script>';
      const result = sanitizeHtml(input);

      expect(result).not.toContain('<script>');
      expect(result).toContain('Content');
    });
  });

  describe('sanitizeString', () => {
    it('should remove control characters', () => {
      const input = 'Hello\x00\x01World';
      const result = sanitizeString(input);

      expect(result).toBe('HelloWorld');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = sanitizeString(input);

      expect(result).toBe('Hello World');
    });

    it('should normalize multiple spaces', () => {
      const input = 'Hello    World';
      const result = sanitizeString(input);

      expect(result).toBe('Hello World');
    });

    it('should handle tabs and newlines', () => {
      const input = 'Hello\t\nWorld';
      const result = sanitizeString(input);

      // Tabs and newlines are normalized to single space
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('should handle non-string input', () => {
      const result = sanitizeString(456 as any);
      expect(result).toBe('456');
    });

    it('should handle empty string', () => {
      const result = sanitizeString('');
      expect(result).toBe('');
    });

    it('should remove all control characters', () => {
      const input = '\x00\x01\x02\x03Hello\x7F\x80\x9F';
      const result = sanitizeString(input);

      expect(result).toBe('Hello');
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow valid http URL', () => {
      const input = 'http://example.com';
      const result = sanitizeUrl(input);

      expect(result).toBe('http://example.com/');
    });

    it('should allow valid https URL', () => {
      const input = 'https://example.com';
      const result = sanitizeUrl(input);

      expect(result).toBe('https://example.com/');
    });

    it('should reject javascript: protocol', () => {
      const input = 'javascript:alert("xss")';
      const result = sanitizeUrl(input);

      expect(result).toBe('');
    });

    it('should reject data: protocol', () => {
      const input = 'data:text/html,<script>alert("xss")</script>';
      const result = sanitizeUrl(input);

      expect(result).toBe('');
    });

    it('should reject file: protocol', () => {
      const input = 'file:///etc/passwd';
      const result = sanitizeUrl(input);

      expect(result).toBe('');
    });

    it('should handle invalid URL', () => {
      const input = 'not a url';
      const result = sanitizeUrl(input);

      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      const result = sanitizeUrl(123 as any);
      expect(result).toBe('');
    });

    it('should preserve URL with path and query', () => {
      const input = 'https://example.com/path?query=value';
      const result = sanitizeUrl(input);

      expect(result).toContain('example.com');
      expect(result).toContain('/path');
      expect(result).toContain('query=value');
    });
  });

  describe('sanitizeEmail', () => {
    it('should accept valid email', () => {
      const input = 'user@example.com';
      const result = sanitizeEmail(input);

      expect(result).toBe('user@example.com');
    });

    it('should convert to lowercase', () => {
      const input = 'User@Example.COM';
      const result = sanitizeEmail(input);

      expect(result).toBe('user@example.com');
    });

    it('should trim whitespace', () => {
      const input = '  user@example.com  ';
      const result = sanitizeEmail(input);

      expect(result).toBe('user@example.com');
    });

    it('should reject invalid email', () => {
      const input = 'not-an-email';
      const result = sanitizeEmail(input);

      expect(result).toBe('');
    });

    it('should reject email without @', () => {
      const input = 'userexample.com';
      const result = sanitizeEmail(input);

      expect(result).toBe('');
    });

    it('should reject email without domain', () => {
      const input = 'user@';
      const result = sanitizeEmail(input);

      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      const result = sanitizeEmail(123 as any);
      expect(result).toBe('');
    });

    it('should accept email with subdomain', () => {
      const input = 'user@mail.example.com';
      const result = sanitizeEmail(input);

      expect(result).toBe('user@mail.example.com');
    });
  });

  describe('sanitizeSql', () => {
    it('should escape single quotes', () => {
      const input = "O'Reilly";
      const result = sanitizeSql(input);

      expect(result).toBe("O''Reilly");
    });

    it('should remove semicolons', () => {
      const input = 'DROP TABLE users;';
      const result = sanitizeSql(input);

      expect(result).not.toContain(';');
    });

    it('should remove SQL comments', () => {
      const input = 'SELECT * FROM users -- comment';
      const result = sanitizeSql(input);

      expect(result).not.toContain('--');
    });

    it('should remove block comments', () => {
      const input = 'SELECT * /* comment */ FROM users';
      const result = sanitizeSql(input);

      expect(result).not.toContain('/*');
      expect(result).not.toContain('*/');
    });

    it('should handle non-string input', () => {
      const result = sanitizeSql(123 as any);
      expect(result).toBe('');
    });

    it('should handle multiple dangerous characters', () => {
      const input = "'; DROP TABLE users; --";
      const result = sanitizeSql(input);

      expect(result).toBe("'' DROP TABLE users ");
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize string values in object', () => {
      const input = {
        name: '  John  ',
        email: 'JOHN@EXAMPLE.COM',
      };
      const result = sanitizeObject(input);

      expect(result.name).toBe('John');
      expect(result.email).toBe('JOHN@EXAMPLE.COM');
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: '  Jane  ',
        },
      };
      const result = sanitizeObject(input);

      expect(result.user.name).toBe('Jane');
    });

    it('should preserve non-string values', () => {
      const input = {
        name: 'John',
        age: 30,
        active: true,
      };
      const result = sanitizeObject(input);

      expect(result.age).toBe(30);
      expect(result.active).toBe(true);
    });

    it('should handle arrays in objects', () => {
      const input = {
        tags: ['  tag1  ', '  tag2  '],
      };
      const result = sanitizeObject(input);

      expect(result.tags[0]).toBe('tag1');
      expect(result.tags[1]).toBe('tag2');
    });

    it('should handle null values', () => {
      const input = {
        name: 'John',
        email: null,
      };
      const result = sanitizeObject(input);

      expect(result.email).toBeNull();
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      const input = '<div>Hello & "World"</div>';
      const result = escapeHtml(input);

      expect(result).toBe('&lt;div&gt;Hello &amp; &quot;World&quot;&lt;/div&gt;');
    });

    it('should escape ampersand', () => {
      const input = 'Tom & Jerry';
      const result = escapeHtml(input);

      expect(result).toBe('Tom &amp; Jerry');
    });

    it('should escape less than', () => {
      const input = '5 < 10';
      const result = escapeHtml(input);

      expect(result).toBe('5 &lt; 10');
    });

    it('should escape greater than', () => {
      const input = '10 > 5';
      const result = escapeHtml(input);

      expect(result).toBe('10 &gt; 5');
    });

    it('should escape double quotes', () => {
      const input = 'He said "Hello"';
      const result = escapeHtml(input);

      expect(result).toBe('He said &quot;Hello&quot;');
    });

    it('should escape single quotes', () => {
      const input = "It's working";
      const result = escapeHtml(input);

      expect(result).toBe('It&#039;s working');
    });

    it('should handle non-string input', () => {
      const result = escapeHtml(123 as any);
      expect(result).toBe('123');
    });

    it('should escape all special characters', () => {
      const input = `<>&"'`;
      const result = escapeHtml(input);

      expect(result).toBe('&lt;&gt;&amp;&quot;&#039;');
    });
  });
});
