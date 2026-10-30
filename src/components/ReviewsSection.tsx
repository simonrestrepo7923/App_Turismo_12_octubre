import React, { useMemo, useState } from 'react';
import type { ReviewTarget } from '../types';
import { useAppStore } from '../store/AppStore';
import { getRating, getReviewsFor } from '../store/selectors';
import { useAuthPrompt } from '../hooks/useAuthPrompt';
import { formatShortDate } from '../lib/format';
import { StarDisplay, StarInput } from './ui/StarRating';
import { useToast } from './ui/Toast';
import { Icon } from './ui/Icon';

interface ReviewsSectionProps {
  targetType: ReviewTarget;
  targetId: string;
  targetName: string;
}

const PAGE = 4;

/**
 * Valoraciones y comentarios (VAL-001).
 * Escenario 1: el turista califica de 1 a 5 y comenta; se guarda asociado al lugar.
 * Escenario 2: se muestra el promedio y los comentarios de otros visitantes.
 */
export const ReviewsSection: React.FC<ReviewsSectionProps> = ({ targetType, targetId, targetName }) => {
  const { reviews, ratings, currentUser, addReview } = useAppStore();
  const promptLogin = useAuthPrompt();
  const toast = useToast();
  const [visible, setVisible] = useState(PAGE);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<{ stars?: string; comment?: string }>({});

  const list = useMemo(() => getReviewsFor(reviews, targetType, targetId), [reviews, targetType, targetId]);
  const summary = getRating(ratings, targetType, targetId);
  const mine = currentUser ? list.find((r) => r.userId === currentUser.id) : undefined;
  const distribution = [5, 4, 3, 2, 1].map((n) => ({ n, count: list.filter((r) => r.rating === n).length }));
  const ordered = mine ? [mine, ...list.filter((r) => r !== mine)] : list;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      promptLogin('Inicia sesión para publicar tu valoración.');
      return;
    }
    const next: typeof errors = {};
    if (stars === 0) next.stars = 'Selecciona una calificación de 1 a 5 estrellas.';
    if (comment.trim().length < 3) next.comment = 'Escribe un comentario breve sobre tu experiencia.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const result = addReview({ targetType, targetId, rating: stars, comment });
    if (result.ok) {
      toast(mine ? 'Actualizamos tu valoración.' : '¡Gracias! Tu valoración fue publicada.', { tone: 'success' });
      setStars(0);
      setComment('');
    }
  };

  return (
    <section aria-labelledby={`reviews-${targetId}`} className="space-y-4">
      <h2 id={`reviews-${targetId}`} className="font-serif text-xl font-bold text-primary flex items-center gap-2">
        <Icon name="reviews" className="text-secondary" />
        Valoraciones y comentarios
      </h2>

      <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/60">
        <div className="text-center shrink-0">
          <p className="font-serif text-4xl font-bold text-primary leading-none">{summary.count ? summary.average.toFixed(1) : '—'}</p>
          <StarDisplay value={summary.average} className="text-[14px]" />
          <p className="text-[11px] text-on-surface-variant mt-0.5">{summary.count} {summary.count === 1 ? 'reseña' : 'reseñas'}</p>
        </div>
        <div className="flex-1 space-y-1">
          {distribution.map(({ n, count }) => (
            <div key={n} className="flex items-center gap-2 text-[11px] text-on-surface-variant">
              <span className="w-2 text-right">{n}</span>
              <div className="flex-1 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                <div className="h-full bg-on-tertiary-container rounded-full" style={{ width: `${list.length ? (count / list.length) * 100 : 0}%` }} />
              </div>
              <span className="w-6 text-right tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="p-4 rounded-2xl border border-outline-variant/70 bg-surface-container-lowest space-y-3" noValidate>
        <p className="text-sm font-bold text-on-surface">{mine ? 'Actualiza tu valoración' : 'Deja tu valoración'}</p>
        <StarInput value={stars} onChange={(v) => { setStars(v); setErrors((er) => ({ ...er, stars: undefined })); }} invalid={!!errors.stars} />
        {errors.stars && <p className="text-xs text-error font-semibold">{errors.stars}</p>}
        <label htmlFor={`comment-${targetId}`} className="sr-only">Comentario</label>
        <textarea
          id={`comment-${targetId}`}
          value={comment}
          onChange={(e) => { setComment(e.target.value); setErrors((er) => ({ ...er, comment: undefined })); }}
          rows={3}
          maxLength={500}
          placeholder={`Comparte tu experiencia en ${targetName}…`}
          aria-invalid={!!errors.comment}
          className={`w-full px-3.5 py-2.5 rounded-xl border bg-surface text-sm outline-none resize-none focus:ring-1 ${
            errors.comment ? 'border-error focus:ring-error' : 'border-outline-variant focus:border-primary focus:ring-primary'
          }`}
        />
        {errors.comment && <p className="text-xs text-error font-semibold">{errors.comment}</p>}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-outline">{comment.length}/500</span>
          <button type="submit" className="px-5 py-2.5 rounded-full bg-secondary text-white text-sm font-bold hover:bg-secondary/90 active:scale-95 transition-all">
            {currentUser ? 'Publicar valoración' : 'Inicia sesión para valorar'}
          </button>
        </div>
      </form>

      {ordered.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Aún no hay comentarios. ¡Sé la primera persona en valorar este lugar!</p>
      ) : (
        <ul className="space-y-2.5">
          {ordered.slice(0, visible).map((r) => (
            <li key={r.id} className={`p-3.5 rounded-2xl border ${r === mine ? 'border-secondary/40 bg-secondary-fixed/20' : 'border-outline-variant/50 bg-surface-container-lowest'}`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-bold text-on-surface">{r === mine ? 'Tú' : r.authorName}</span>
                <StarDisplay value={r.rating} className="text-[14px]" />
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">{r.comment}</p>
              <p className="text-[11px] text-outline mt-1.5">{formatShortDate(r.date)}</p>
            </li>
          ))}
        </ul>
      )}
      {ordered.length > visible && (
        <button type="button" onClick={() => setVisible((v) => v + PAGE * 2)} className="w-full py-2.5 rounded-full border border-outline-variant text-sm font-semibold text-primary hover:bg-surface-container">
          Ver más comentarios ({ordered.length - visible})
        </button>
      )}
    </section>
  );
};
