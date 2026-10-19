// Review notes from each closed day, newest first. Deliberately thin —
// this is not a Notion competitor.

import { useState } from 'react';
import { View } from 'react-native';

import { useStore } from '../core/store';
import { colors, space } from '../core/theme';
import { prettyDate, shortDate } from '../core/dates';
import { MOODS } from '../core/copy';
import { closeTally } from '../core/logic/plan';
import { Card, Field, Kicker, Screen, T } from '../components/ui';
import { EmptyNote } from '../components/parts';
import { BackHeader } from '../components/BackHeader';

// F5.5 — search across every note, daily and weekly.
export default function Journal() {
  const { plans, itemsByPlan, weekReviews } = useStore();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const match = (text) => !needle || (text || '').toLowerCase().includes(needle);
  const closed = plans
    .filter((p) => p.closed_at && match(p.review_note))
    .sort((a, b) => b.date.localeCompare(a.date));
  const weeks = Object.values(weekReviews)
    .filter((w) => w.note && match(w.note))
    .sort((a, b) => b.week_start.localeCompare(a.week_start));
  return (
    <Screen>
      <BackHeader title="Journal" kicker="Review notes" />
      <Field value={q} onChangeText={setQ} placeholder="Search your notes" autoCapitalize="none" style={{ marginBottom: space.lg }} />
      {weeks.length ? (
        <>
          <Kicker>Weeks</Kicker>
          {weeks.map((w) => (
            <Card key={w.id} tone="elevated" style={{ marginBottom: space.sm }}>
              <T v="emphasis">Week of {shortDate(w.week_start)}</T>
              <T style={{ marginTop: space.sm }}>{w.note}</T>
            </Card>
          ))}
          <Kicker style={{ marginTop: space.md }}>Days</Kicker>
        </>
      ) : null}
      {closed.length ? (
        closed.map((p) => {
          const t = closeTally(itemsByPlan[p.id] || []);
          return (
            <Card key={p.id} style={{ marginBottom: space.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T v="emphasis">{prettyDate(p.date)}</T>
                <T v="data" style={{ fontSize: 13 }}>{t.done}/{t.total}</T>
              </View>
              {p.review_note ? <T style={{ marginTop: space.sm }}>{p.review_note}</T> : <T v="caption" style={{ marginTop: space.sm }}>No note.</T>}
              {p.mood ? <T v="caption" style={{ marginTop: space.sm, color: colors.violet }}>Energy {p.mood}/5 · {MOODS[p.mood - 1]}</T> : null}
            </Card>
          );
        })
      ) : (
        <EmptyNote>{needle ? `Nothing mentions “${q.trim()}” yet.` : 'Close your first day and its note lands here.'}</EmptyNote>
      )}
    </Screen>
  );
}
