// Review notes from each closed day, newest first. Deliberately thin —
// this is not a Notion competitor.

import { View } from 'react-native';

import { useStore } from '../core/store';
import { colors, space } from '../core/theme';
import { prettyDate } from '../core/dates';
import { MOODS } from '../core/copy';
import { closeTally } from '../core/logic/plan';
import { Card, Screen, T } from '../components/ui';
import { EmptyNote } from '../components/parts';
import { BackHeader } from '../components/BackHeader';

export default function Journal() {
  const { plans, itemsByPlan } = useStore();
  const closed = plans.filter((p) => p.closed_at).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Screen>
      <BackHeader title="Journal" kicker="Review notes" />
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
        <EmptyNote>Close your first day and its note lands here.</EmptyNote>
      )}
    </Screen>
  );
}
