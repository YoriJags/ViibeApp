content = open('frontend/app/venue/[id].tsx', encoding='utf-8').read()

# 1. Add activeTab state
old_state = "  const [surgeTapCount, setSurgeTapCount] = useState(0);"
new_state = "  const [surgeTapCount, setSurgeTapCount] = useState(0);\n  const [activeTab, setActiveTab] = useState<'now' | 'intel' | 'crew' | 'info'>('now');"
content = content.replace(old_state, new_state, 1)
print('state:', new_state[:60] in content)

# 2. Replace the long flat section list with tabbed sections
marker = "        {/* ====== AI TAKE (Roast & Toast) ====== */}"
end_marker = "        {/* Location Card */}"

start = content.find(marker)
end = content.find(end_marker)
print(f'start={start}, end={end}')
if start == -1 or end == -1:
    print('ERROR: markers not found')
    exit(1)

tab_html = """        {/* ====== TAB NAVIGATION ====== */}
        <View style={styles.tabBar}>
          {([
            { key: 'now',   label: 'NOW',   icon: 'flash' },
            { key: 'intel', label: 'INTEL', icon: 'analytics' },
            { key: 'crew',  label: 'CREW',  icon: 'people' },
            { key: 'info',  label: 'INFO',  icon: 'information-circle' },
          ] as const).map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? '#FF3366' : '#3A3A4E'} />
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
              {activeTab === tab.key && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* NOW — live energy + surge + intent */}
        {activeTab === 'now' && <>
          {id && <ErrorBoundary label="Vibe Surge"><VibeSurgeBar venueId={id} venueName={venue?.name ?? ''} isDemoMode={isDemoMode} onElectric={(tc) => { setSurgeTapCount(tc); setShowSurgeCelebration(true); }} /></ErrorBoundary>}
          {id && <VenueIntentBar venueId={id} venueName={venue?.name} />}
        </>}

        {/* INTEL — predictions, crowd, timing */}
        {activeTab === 'intel' && <>
          {id && isFeatureEnabled('vibe_oracle') && <ErrorBoundary label="Vibe Oracle"><VibeOracle venueId={id} venueName={venue?.name} /></ErrorBoundary>}
          {id && venue && isFeatureEnabled('roast_toast') && <ErrorBoundary label="AI Take"><VenueRoastCard venueId={id} venueName={venue.name} isDemoMode={isDemoMode} /></ErrorBoundary>}
          {id && <ErrorBoundary label="Arrival Intel"><ArrivalIntelCard venueId={id} isDemoMode={isDemoMode} /></ErrorBoundary>}
          {id && <ErrorBoundary label="Crowd"><CrowdCompositionBar venueId={id} isDemoMode={isDemoMode} /></ErrorBoundary>}
          {venueTimeline.length > 0 && <ErrorBoundary label="Timeline"><VibeTimeline timeline={venueTimeline} peakHour={timelinePeakHour} /></ErrorBoundary>}
          {id && <ErrorBoundary label="Forecast"><View style={{ paddingHorizontal: 16, marginTop: 12 }}><VibeForecast venueId={id} /></View></ErrorBoundary>}
        </>}

        {/* CREW — scouts + social */}
        {activeTab === 'crew' && <>
          {id && isFeatureEnabled('top_scouts') && <ErrorBoundary label="Top Scouts"><TopScoutsCard venueId={id} /></ErrorBoundary>}
        </>}

        {/* INFO — location, booking, status */}
        {activeTab === 'info' && <>
          {venue.active_campaign_multiplier && <View style={{ paddingHorizontal: 16, marginTop: 12 }}><CampaignBadge multiplier={venue.active_campaign_multiplier} expiresAt={venue.active_campaign_expires} /></View>}
          {venue.vibe_certified && <View style={{ paddingHorizontal: 16, marginTop: 12 }}><CertifiedBadge score={venue.certification_score} /></View>}
"""

content = content[:start] + tab_html + content[end:]
print('tabs inserted:', 'TAB NAVIGATION' in content)
open('frontend/app/venue/[id].tsx', 'w', encoding='utf-8').write(content)
print('saved, lines:', content.count('\n'))
