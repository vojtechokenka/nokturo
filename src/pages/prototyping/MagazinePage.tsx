import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { canDeleteAnything } from '../../lib/rbac';
import { PageShell } from '../../components/PageShell';
import { MaterialIcon } from '../../components/icons/MaterialIcon';
import { DeleteConfirmModal } from '../../components/DeleteConfirmModal';
import { DeleteIcon } from '../../components/icons/DeleteIcon';
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
      bare
      actionsSlot={
        <div className="sticky top-0 z-10 w-full px-4 sm:px-6 py-4 flex items-center justify-between bg-[#0d0d0d] rounded-[6px]">
          <div className="flex gap-1">
            {(['published', 'drafts'] as const).map((tab) => {
              const isActive = showHidden === (tab === 'drafts');
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setShowHidden(tab === 'drafts')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-black text-nokturo-900 dark:text-nokturo-100 rounded-t-[6px] rounded-b-none'
                      : 'text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-700 dark:hover:text-nokturo-300'
                  }`}
                >
                  {tab === 'published' ? (
                    <MaterialIcon name="article" size={20} className="shrink-0 opacity-60" />
                  ) : (
                    <MaterialIcon name="edit_note" size={20} className="shrink-0 opacity-60" />
                  )}
                  {t(`magazine.${tab}`)}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => navigate('/prototyping/magazine/new')}
            className="flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium rounded-[6px] bg-nokturo-700 text-white hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:border dark:border-nokturo-700 dark:hover:bg-nokturo-100 transition-colors shrink-0"
          >
            <MaterialIcon name="add" size={16} className="shrink-0" />
            {t('magazine.addNew')}
          </button>
        </div>
      }
    >
      <div className="flex flex-col min-h-0 flex-1">
        {/* Content */}
        {loading ? (
        <div className="flex items-center justify-center py-20 px-4 sm:px-6">
          <MaterialIcon name="progress_activity" size={24} className="text-nokturo-500 animate-spin shrink-0" />
        </div>
      ) : visibleArticles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4 sm:px-6">
          <p className="text-nokturo-600 dark:text-nokturo-400 font-medium">
            {showHidden
              ? t('magazine.noDrafts')
              : t('magazine.noArticles')}
          </p>
          {!showHidden && (
            <p className="text-nokturo-500 dark:text-nokturo-400 text-sm mt-1">
              {t('magazine.addFirst')}
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-4 sm:px-6 pb-6">
          {visibleArticles.map((article) => {
            const dateStr = article.created_at
              ? (() => {
                  const d = new Date(article.created_at);
                  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
                })()
              : null;
            return (
              <article
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
                className="group flex flex-col cursor-pointer"
              >
                {/* Thumbnail 4:5, no corner radius */}
                <div className="aspect-[4/5] w-full overflow-hidden bg-nokturo-100 dark:bg-nokturo-700 flex items-center justify-center relative">
                  {article.thumbnail_url ? (
                    <img
                      src={article.thumbnail_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <MaterialIcon name="description" size={40} className="text-nokturo-400 shrink-0" />
                  )}
                  {/* Three-dot menu – top-right on hover */}
                  <div
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === article.id ? null : article.id);
                      }}
                      className="p-2 text-white hover:text-white/90 rounded-[4px] hover:bg-black/20 transition-colors"
                    >
                      <MaterialIcon name="more_vert" size={16} className="shrink-0" />
                    </button>
                    {menuOpen === article.id && (
                      <div className="dropdown-menu absolute right-0 top-full mt-1 shadow-lg py-1 w-max min-w-[140px] z-20">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(null);
                          navigate(`/prototyping/magazine/${article.id}/edit`);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2 whitespace-nowrap"
                      >
                        <MaterialIcon name="edit" size={14} className="shrink-0" />
                        {t('common.edit')}
                      </button>
                      {isFounder && (
                        <button
                          type="button"
                          onClick={() =>
                            handleHide(article.id, !article.hidden)
                          }
                          className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-nokturo-50 dark:hover:bg-nokturo-600 flex items-center gap-2 whitespace-nowrap"
                        >
                          {article.hidden ? (
                            <MaterialIcon name="article" size={14} className="shrink-0" />
                          ) : (
                            <MaterialIcon name="edit_note" size={14} className="shrink-0" />
                          )}
                          {article.hidden
                            ? t('magazine.publish')
                            : t('magazine.moveToDrafts')}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(null);
                            setDeleteTarget(article.id);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-nokturo-700 dark:text-nokturo-200 hover:bg-red hover:text-red-fg flex items-center gap-2 whitespace-nowrap"
                        >
                          <DeleteIcon className="w-3.5 h-3.5" />
                          {t('common.delete')}
                        </button>
                      )}
                    </div>
                    )}
                  </div>
                </div>

                {/* Content: date 14px, 12px gap, heading 32px IvyPresto */}
                <div className="flex flex-col gap-3 mt-3">
                  {dateStr && (
                    <time className="text-[14px] text-nokturo-500 dark:text-nokturo-400">
                      {dateStr}
                    </time>
                  )}
                  <h3 className="font-headline text-[32px] leading-tight text-nokturo-900 dark:text-nokturo-100">
                    {article.title || t('magazine.untitled')}
                  </h3>
                </div>
              </article>
            );
          })}
        </div>
      )}

      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteConfirmModal
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </PageShell>
  );
}
