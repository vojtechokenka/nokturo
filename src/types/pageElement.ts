export type AspectRatio = '5:4' | '1:1' | '3:2' | '16:9';
export type ImageFit = 'fill' | 'hug';
export type GalleryColumns = 2 | 3 | 4;

export interface GalleryImage {
  url: string;
  alt?: string;
  caption?: string;
}

export interface GridCell {
  type: 'text' | 'image';
  content: string;
  caption?: string;
}

export type PageElement =
  | { id: string; type: 'text'; title: string; html: string; titleVisible?: boolean }
  | { id: string; type: 'image'; url: string; alt?: string; fit?: ImageFit; caption?: string }
  | { id: string; type: 'gallery'; columns: GalleryColumns; images: GalleryImage[] }
  | {
      id: string;
      type: 'imageGrid';
      columns: number;
      gapRow: number;
      gapCol: number;
      gapLocked?: boolean;
      aspectRatio?: AspectRatio;
      images: GalleryImage[];
    }
  | {
      id: string;
      type: 'grid';
      columns: number;
      rows: number;
      headerRowCount: number;
      headerColumnCount: number;
      cells: GridCell[];
    }
  | { id: string; type: 'divider' }
  | { id: string; type: 'button'; text: string; url: string; newTab?: boolean };

