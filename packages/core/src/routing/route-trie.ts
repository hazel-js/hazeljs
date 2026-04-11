import type { RouteEntry } from './route.types';

/**
 * Radix-style trie for dynamic routes (paths containing `:param` segments).
 * Static segments are preferred over parameter segments at each level.
 */
export class RouteTrie {
  private root: TrieNode = { static: new Map(), param: undefined };

  clear(): void {
    this.root = { static: new Map(), param: undefined };
  }

  /**
   * @param pathPattern normalized path e.g. `/users/:id`
   */
  insert(pathPattern: string, entry: RouteEntry): void {
    const segments = splitPath(pathPattern);
    let node = this.root;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const isParam = seg.startsWith(':');
      if (isParam) {
        const name = seg.slice(1) || 'param';
        if (!node.param) {
          node.param = { name, child: { static: new Map(), param: undefined } };
        }
        node = node.param.child;
      } else {
        let next = node.static.get(seg);
        if (!next) {
          next = { static: new Map(), param: undefined };
          node.static.set(seg, next);
        }
        node = next;
      }
    }
    node.entry = entry;
    node.pattern = pathPattern;
  }

  /**
   * Match a request path (no query) against registered patterns; returns entry + param map.
   */
  match(
    requestPath: string
  ): { entry: RouteEntry; params: Record<string, string>; pattern: string } | null {
    const segments = splitPath(requestPath);
    return this.matchFrom(this.root, segments, 0, {});
  }

  private matchFrom(
    node: TrieNode,
    segments: string[],
    index: number,
    params: Record<string, string>
  ): { entry: RouteEntry; params: Record<string, string>; pattern: string } | null {
    if (index === segments.length) {
      if (node.entry && node.pattern) {
        return { entry: node.entry, params: { ...params }, pattern: node.pattern };
      }
      return null;
    }

    const seg = segments[index];

    const staticChild = node.static.get(seg);
    if (staticChild) {
      const hit = this.matchFrom(staticChild, segments, index + 1, params);
      if (hit) {
        return hit;
      }
    }

    if (node.param) {
      const nextParams = { ...params, [node.param.name]: seg };
      const hit = this.matchFrom(node.param.child, segments, index + 1, nextParams);
      if (hit) {
        return hit;
      }
    }

    return null;
  }
}

interface TrieNode {
  static: Map<string, TrieNode>;
  param?: { name: string; child: TrieNode };
  entry?: RouteEntry;
  /** Original pattern for extractParams compatibility */
  pattern?: string;
}

function splitPath(path: string): string[] {
  const p = path.startsWith('/') ? path.slice(1) : path;
  if (!p) {
    return [];
  }
  return p.split('/').filter(Boolean);
}
