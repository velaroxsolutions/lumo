// F2.3 — everything not yet scheduled, grouped by Area.

import { useState } from 'react';
import { View } from 'react-native';

import { useTasks } from '../../core/useTasks';
import { colors, space } from '../../core/theme';
import { formatDuration } from '../../core/dates';
import { EMPTY_BACKLOG } from '../../core/copy';
import { Kicker, Press, Screen, T } from '../../components/ui';
import { AreaDot, EmptyNote, rowStyles } from '../../components/parts';
import { CaptureFab, QuickCapture, TaskSheet } from '../../components/sheets';

const PRIO_COLOR = { high: colors.sunbeam, med: null, low: colors.muted };

export default function Backlog() {
  const { groups, backlog } = useTasks();
  const [capture, setCapture] = useState(false);
  const [editing, setEditing] = useState(null);
  const total = backlog.reduce((n, t) => n + (t.estimated_minutes || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight }}>
      <Screen>
        <Kicker>Not scheduled yet</Kicker>
        <T v="h1">Backlog</T>
        <T v="data" style={{ marginTop: 4, marginBottom: space.lg, color: colors.muted }}>
          {backlog.length} tasks · {formatDuration(total)}
        </T>
        {groups.length ? (
          groups.map((g) => (
            <View key={g.area.id} style={{ marginBottom: space.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.sm }}>
                <AreaDot area={g.area} size={12} />
                <T v="h2" style={{ color: g.area.color }}>{g.area.name}</T>
                <T v="caption">{g.tasks.length}</T>
              </View>
              {g.tasks.map((t) => (
                <Press key={t.id} onPress={() => setEditing(t)} scaleTo={0.98} style={rowStyles.row}>
                  {PRIO_COLOR[t.priority] ? (
                    <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: PRIO_COLOR[t.priority] }} />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <T v="emphasis" numberOfLines={2}>{t.title}</T>
                    {t.notes ? <T v="caption" numberOfLines={1}>{t.notes}</T> : null}
                  </View>
                  <T v="data" style={{ fontSize: 13 }}>{formatDuration(t.estimated_minutes)}</T>
                </Press>
              ))}
            </View>
          ))
        ) : (
          <EmptyNote>{EMPTY_BACKLOG}</EmptyNote>
        )}
      </Screen>
      <CaptureFab onPress={() => setCapture(true)} />
      <QuickCapture visible={capture} onClose={() => setCapture(false)} />
      <TaskSheet task={editing} visible={!!editing} onClose={() => setEditing(null)} />
    </View>
  );
}
