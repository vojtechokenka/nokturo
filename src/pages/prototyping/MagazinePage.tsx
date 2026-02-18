import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { canDeleteAnything } from '../../lib/rbac';
import { PageShell } from '../../components/PageShell';
import {
  Plus,
  Loader2,
  FileText,
  MoreVertical,
  Pencil,
  EyeOff,
  Eye,
  Trash2,
} from 'lucide-react';
import type { RichTextBlock } from '../../components/RichTextBlockEditor';

interface MagazineArticle {
  id: string;
  title: string;
  thumbnail_url: string | null;
  content: RichTextBlock[];
  hidden: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function extractPerex(content: RichTextBlock[]): string | null {
  if (!Array.isArray(content)) return null;
  const firstParagraph = content.find(
    (b) => b.type === 'paragraph' && b.content?.trim(),
  );
  if (!firstParagraph?.content) return null;
  const text = firstParagraph.content.replace(/<[^>]*>/g, '').trim();
  return text || null;
}

export default function MagazinePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isFounder = user?.role === 'founder';
  const canDelete = canDeleteAnything(user?.role ?? 'client');

  const [articles, setArticles] = useState<MagazineArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = () => setMenuOpen(null);
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, [menuOpen]);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('magazine_articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setArticles(data as MagazineArticle[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleHide = async (id: string, hidden: boolean) => {
    setMenuOpen(null);
    const { error } = await supabase
      .from('magazine_articles')
      .update({ hidden })
      .eq('id', id);
    if (!error) {
      setArticles((prev) =>
        prev.map((a) => (a.id === id ? { ...a, hidden } : a)),
      );
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('magazine_articles')
      .delete()
      .eq('id', id);
    if (!error) {
      setArticles((prev) => prev.filter((a) => a.id !== id));
    }
    setDeleteTarget(null);
  };

  const visibleArticles = articles.filter((a) =>
    showHidden ? a.hidden : !a.hidden,
  );

  return (
    <PageShell
      titleKey="pages.magazine.title"
      descriptionKey="pages.magazine.description"
    >
      {/* Action bar */}
      <div className="flex items-center gap-3 mb-6">
        {isFounder && (
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            className={`flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-lg transition-colors ${
              showHidden
                ? 'bg-nokturo-200 dark:bg-nokturo-700 text-nokturo-900 dark:text-nokturo-100'
                : 'text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-100 dark:hover:bg-nokturo-700'
            }`}
          >
            {showHidden ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
            {t('magazine.hiddenArticles')}
          </button>
        )}

        <div className="flex-1" />

        <button
          onClick={() => navigate('/prototyping/magazine/new')}
          className="flex items-center justify-center gap-2 h-9 bg-nokturo-700 text-white font-medium rounded-lg px-4 text-sm hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:border dark:border-nokturo-700 dark:hover:bg-nokturo-100 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t('magazine.addNew')}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-nokturo-500 animate-spin" />
        </div>
      ) : visibleArticles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="w-12 h-12 text-nokturo-400 mb-4" />
          <p className="text-nokturo-600 dark:text-nokturo-400 font-medium">
            {showHidden
              ? t('magazine.noHiddenArticles')
              : t('magazine.noArticles')}
          </p>
          {!showHidden && (
            <p className="text-nokturo-500 dark:text-nokturo-400 text-sm mt-1">
              {t('magazine.addFirst')}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-nokturo-200 dark:divide-nokturo-700">
          {visibleArticles.map((article) => {
            const perex = extractPerex(article.content);
            return (
              <div
                key={article.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  navigate(`/prototyping/magazine/${article.id}`)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/prototyping/magazine/${article.id}`);
                  }
                }}
                className="flex items-center gap-4 py-4 hover:bg-nokturo-50/50 dark:hover:bg-nokturo-800/40 transition-colors cursor-pointer"
              >
                {/* Thumbnail */}
                <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-lg overflow-hidden bg-nokturo-100 dark:bg-nokturo-700 flex items-center justify-center">
                  {article.thumbnail_url ? (
                    <img
                      src={article.thumbnail_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileText className="w-7 h-7 text-nokturo-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-medium text-nokturo-900 dark:text-nokturo-100 truncate">
                    {article.title || t('magazine.untitled')}
                  </h3>
                  {perex && (
                    <p className="text-sm text-nokturo-500 dark:text-nokturo-400 mt-0.5 truncate max-w-[480px]">
                      {perex}
                    </p>
                  )}
                </div>

                {/* Three-dot menu */}
                <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === article.id ? null : article.id);
                    }}
                    className="p-2 text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuOpen === article.id && (
                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-nokturo-700 rounded-lg shadow-lg py-1 min-w-[140px] z-20">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(null);
                          navigate(`/prototyping/magazine/${article.id}/edit`);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {t('common.edit')}
                      </button>
                      {isFounder && (
                        <button
                          type="button"
                          onClick={() =>
                            handleHide(article.id, !article.hidden)
                          }
                          className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2"
                        >
                          {article.hidden ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                          {article.hidden
                            ? t('magazine.unhide')
                            : t('magazine.hide')}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(null);
                            setDeleteTarget(article.id);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t('common.delete')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-nokturo-900/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-nokturo-800 rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-2">
              {t('common.confirm')}
            </h3>
            <p className="text-nokturo-600 dark:text-nokturo-400 text-sm mb-4">
              {t('magazine.deleteConfirm')}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 text-sm bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
