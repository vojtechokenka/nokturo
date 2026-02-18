import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { RichTextBlockViewer } from '../../components/RichTextBlockViewer';
import type { RichTextBlock } from '../../components/RichTextBlockEditor';
import {
  ArrowLeft,
  Loader2,
  FileText,
  Pencil,
} from 'lucide-react';

interface MagazineArticle {
  id: string;
  title: string;
  thumbnail_url: string | null;
  content: RichTextBlock[];
  created_at: string;
}

export default function MagazineArticlePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [article, setArticle] = useState<MagazineArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase
      .from('magazine_articles')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setArticle({
            ...data,
            content: Array.isArray(data.content) ? data.content : [],
          } as MagazineArticle);
        }
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <PageShell titleKey="pages.magazine.title" descriptionKey="pages.magazine.description">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-nokturo-500" />
        </div>
      </PageShell>
    );
  }

  if (!article) {
    return (
      <PageShell titleKey="pages.magazine.title" descriptionKey="pages.magazine.description">
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <FileText className="w-16 h-16 text-nokturo-400 mb-4" />
          <p className="text-nokturo-600 dark:text-nokturo-400 font-medium">
            {t('magazine.notFound')}
          </p>
          <button
            onClick={() => navigate('/prototyping/magazine')}
            className="mt-4 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100"
          >
            {t('common.back')}
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell titleKey="pages.magazine.title" descriptionKey="pages.magazine.description">
      <div className="max-w-3xl">
        {/* Back + Edit */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/prototyping/magazine')}
            className="flex items-center gap-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </button>
          <button
            onClick={() => navigate(`/prototyping/magazine/${id}/edit`)}
            className="flex items-center gap-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 px-3 py-1.5 rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            {t('common.edit')}
          </button>
        </div>

        {/* Thumbnail */}
        {article.thumbnail_url && (
          <div className="mb-8 rounded-lg overflow-hidden">
            <img
              src={article.thumbnail_url}
              alt=""
              className="w-full max-h-[400px] object-cover"
            />
          </div>
        )}

        {/* Title */}
        <h1 className="font-headline text-[32px] sm:text-[48px] leading-[1.2] font-extralight text-nokturo-900 dark:text-nokturo-100 mb-8">
          {article.title || t('magazine.untitled')}
        </h1>

        {/* Rich text content */}
        {article.content.length > 0 && (
          <RichTextBlockViewer blocks={article.content} showToc={false} />
        )}
      </div>
    </PageShell>
  );
}
