import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { RecallMatch } from '@/utils/recall-checker';

interface Props {
  alerts: RecallMatch[];
  onDismiss: (pairId: string) => void;
  onDismissAll: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(raw: string): string {
  if (!raw) return '';
  // Handles YYYYMMDD, ISO, or plain strings
  const iso = raw.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
  const d = new Date(iso);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function riskColor(level: string): string {
  const l = level.toLowerCase();
  if (l.includes('i') && !l.includes('ii') && !l.includes('iii')) return '#EF4444'; // Class I = most serious
  if (l.includes('ii') && !l.includes('iii')) return '#F97316';
  if (l.includes('iii')) return '#FACC15';
  return '#F97316';
}

// Group alerts by pantry item name, deduplicating recalls with the same id
function groupByItem(alerts: RecallMatch[]): { name: string; pairIds: string[]; recalls: RecallMatch[] }[] {
  const map = new Map<string, { name: string; pairIds: string[]; recallIds: Set<string>; recalls: RecallMatch[] }>();

  for (const alert of alerts) {
    const key = alert.pantryItemName.trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, { name: alert.pantryItemName, pairIds: [], recallIds: new Set(), recalls: [] });
    }
    const entry = map.get(key)!;
    entry.pairIds.push(alert.pairId);
    // Only add the recall detail once per unique recall id
    if (!entry.recallIds.has(alert.recall.id)) {
      entry.recallIds.add(alert.recall.id);
      entry.recalls.push(alert);
    }
  }

  return Array.from(map.values());
}

// ── Sub-components ─────────────────────────────────────────────────────────

function RecallDetail({ match }: { match: RecallMatch }) {
  const { recall } = match;
  const date = formatDate(recall.date);
  const hasRisk = Boolean(recall.riskLevel);

  return (
    <View style={detailStyles.container}>
      <View style={detailStyles.headerRow}>
        <View style={[detailStyles.sourceBadge,
          recall.source === 'FDA'   && detailStyles.fda,
          recall.source === 'USDA'  && detailStyles.usda,
          recall.source === 'FSA'   && detailStyles.fsa,
          recall.source === 'FSSAI' && detailStyles.fssai,
        ]}>
          <Text style={detailStyles.sourceText}>{recall.source}</Text>
        </View>
        {hasRisk && (
          <View style={[detailStyles.riskBadge, { borderColor: riskColor(recall.riskLevel!) }]}>
            <Text style={[detailStyles.riskText, { color: riskColor(recall.riskLevel!) }]}>
              {recall.riskLevel}
            </Text>
          </View>
        )}
        {date ? <Text style={detailStyles.date}>{date}</Text> : null}
      </View>

      {recall.productDescription ? (
        <View style={detailStyles.row}>
          <Text style={detailStyles.label}>Product</Text>
          <Text style={detailStyles.value}>{recall.productDescription}</Text>
        </View>
      ) : null}

      {recall.reason ? (
        <View style={detailStyles.row}>
          <Text style={detailStyles.label}>Reason</Text>
          <Text style={detailStyles.value}>{recall.reason}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ItemRow({
  group,
  onDismissGroup,
}: {
  group: { name: string; pairIds: string[]; recalls: RecallMatch[] };
  onDismissGroup: (pairIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.itemBlock}>
      <TouchableOpacity style={styles.itemHeader} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
        <View style={styles.itemHeaderLeft}>
          <Text style={styles.itemName}>{group.name}</Text>
          <Text style={styles.recallCount}>
            {group.recalls.length} recall{group.recalls.length !== 1 ? 's' : ''} matched · tap for details
          </Text>
        </View>
        <View style={styles.itemHeaderRight}>
          <IconSymbol
            name={open ? 'chevron.up' : 'chevron.down'}
            size={11}
            color="rgba(255,255,255,0.6)"
          />
          <TouchableOpacity
            onPress={() => onDismissGroup(group.pairIds)}
            hitSlop={10}
            style={styles.dismissBtn}>
            <IconSymbol name="xmark.circle.fill" size={20} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {open && (
        <View style={styles.detailsContainer}>
          {group.recalls.map((match) => (
            <RecallDetail key={match.recall.id} match={match} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Banner ─────────────────────────────────────────────────────────────────

export function RecallAlertBanner({ alerts, onDismiss, onDismissAll }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (alerts.length === 0) return null;

  const groups = groupByItem(alerts);

  function confirmDismissAll() {
    Alert.alert(
      'Dismiss all recall alerts?',
      "These alerts won't appear again unless a new recall check finds a match.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Dismiss all', style: 'destructive', onPress: onDismissAll },
      ],
    );
  }

  function dismissGroup(pairIds: string[]) {
    pairIds.forEach((id) => onDismiss(id));
  }

  return (
    <View style={styles.container}>
      {/* Header — full row is the expand/collapse tap target */}
      <TouchableOpacity style={styles.header} onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
        <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#fff" />
        <Text style={styles.headerTitle}>
          Food Safety Alert — {groups.length} item{groups.length !== 1 ? 's' : ''} recalled
        </Text>
        <IconSymbol
          name={expanded ? 'chevron.up' : 'chevron.down'}
          size={14}
          color="rgba(255,255,255,0.8)"
        />
      </TouchableOpacity>

      {/* Expanded body */}
      {expanded && (
        <View>
          <ScrollView
            style={styles.scrollList}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            indicatorStyle="white">
            {groups.map((group) => (
              <ItemRow key={group.name} group={group} onDismissGroup={dismissGroup} />
            ))}
          </ScrollView>
          <Text style={styles.safetyNote}>
            Discard recalled products safely — do not consume.
          </Text>
          {/* Dismiss all — full-width, clearly separated from the chevron */}
          <TouchableOpacity style={styles.dismissAllBtn} onPress={confirmDismissAll} activeOpacity={0.8}>
            <Text style={styles.dismissAllText}>Dismiss all alerts</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const BG = '#B91C1C';
const BG_LIGHT = '#DC2626';

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 2,
    borderRadius: 12,
    backgroundColor: BG,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: BG_LIGHT,
  },
  headerTitle: { color: '#fff', fontWeight: '700', fontSize: 13, flex: 1 },
  dismissAllBtn: {
    margin: 12,
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
  },
  dismissAllText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  scrollList: { maxHeight: 320 },

  itemBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  itemHeaderLeft: { flex: 1 },
  itemHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  recallCount: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },
  dismissBtn: { padding: 2 },

  detailsContainer: { paddingHorizontal: 14, paddingBottom: 10, gap: 8 },

  safetyNote: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
});

const detailStyles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  sourceBadge: {
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: '#374151',
  },
  fda:   { backgroundColor: '#1D4ED8' },
  usda:  { backgroundColor: '#15803D' },
  fsa:   { backgroundColor: '#7C3AED' },
  fssai: { backgroundColor: '#EA580C' },
  sourceText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  riskBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  riskText: { fontSize: 10, fontWeight: '700' },
  date: { color: 'rgba(255,255,255,0.55)', fontSize: 11 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    width: 52,
    marginTop: 1,
    flexShrink: 0,
  },
  value: { color: 'rgba(255,255,255,0.88)', fontSize: 12, lineHeight: 17, flex: 1 },
});
