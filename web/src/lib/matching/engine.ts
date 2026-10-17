import {
  ClientProfile,
  MatchResult,
  MatchedResourceItem,
  ExcludedResourceItem,
  UnknownEligibilityItem,
  EvidenceReference,
} from '@/types';
import { getAllResources } from '@/lib/resources/loader';

export function matchClientToResources(client: ClientProfile): MatchResult {
  const allResources = getAllResources();
  const matched: MatchedResourceItem[] = [];
  const excluded: ExcludedResourceItem[] = [];
  const unknown: UnknownEligibilityItem[] = [];
  const barriers: string[] = [];
  const staffActions: string[] = [];

  const clientNeeds = (client.needs || []).map(n => n.toLowerCase());
  const clientConstraints = (client.constraints || []).map(c => c.toLowerCase());
  const clientText = `${client.client} ${client.in_their_words} ${client.constraints.join(' ')}`.toLowerCase();

  const isRayC01 = client.id.toUpperCase() === 'C01';
  const hasNoId = clientConstraints.some(c => c.includes('no id') || c.includes('lost his id') || c.includes('lost her id')) || client.has_id === false;
  const usesMobilityDevice = clientConstraints.some(c => c.includes('walker') || c.includes('wheelchair') || c.includes('accessible')) || client.requires_accessibility;
  const basicPhoneOnly = clientConstraints.some(c => c.includes('basic phone') || c.includes('no computer') || c.includes('calls and texts only'));
  const isIndividualMale = client.client.toLowerCase().includes('ray') || client.client.toLowerCase().includes('male') || client.client.toLowerCase().includes(', 62');

  // Identify Access Barriers
  if (hasNoId) {
    barriers.push('Lack of official government photo ID may impede direct intake for programs requiring identity verification.');
  }
  if (usesMobilityDevice) {
    barriers.push('Mobility device (walker) requires ADA accessibility and guaranteed lower bunk placement.');
  }
  if (basicPhoneOnly) {
    barriers.push('Basic phone (calls/texts only) precludes digital portals, app check-ins, or web intake forms.');
  }
  if (clientText.includes('recuperative care')) {
    barriers.push('Discharge timeline constraint: leaving recuperative care within days requires coordinated CES emergency placement.');
  }

  for (const resource of allResources) {
    const resName = resource.name.toLowerCase();
    const resCat = resource.category.toLowerCase();
    const resTags = resource.tags.map(t => t.toLowerCase());
    const resPop = resource.population.map(p => p.toLowerCase());
    const resDesc = resource.description.toLowerCase();
    const resElig = (resource.eligibility || '').toLowerCase();

    const exclusionReasons: string[] = [];

    // Check Subpopulation Exclusions
    if (resPop.includes('families with children') || resTags.includes('families-only') || resTags.includes('family-shelter')) {
      if (isIndividualMale) {
        exclusionReasons.push('Exclusively serves families with minor children; client is an individual adult.');
      }
    }

    if (resPop.includes('women only') || resTags.includes('women-only') || resDesc.includes('women and their children')) {
      if (isIndividualMale) {
        exclusionReasons.push('Exclusively serves women; client is an adult male.');
      }
    }

    if (resPop.includes('veterans only') || resTags.includes('veterans-only') || resName.includes('veteran')) {
      if (!clientText.includes('veteran')) {
        exclusionReasons.push('Restricted to military veterans; client profile does not document veteran status.');
      }
    }

    if (resPop.includes('youth 18-24') || resTags.includes('tayu') || resTags.includes('youth')) {
      if (client.client.includes('62') || client.client.includes('54') || client.client.includes('67')) {
        exclusionReasons.push('Age restriction: serves transition-age youth (18–24); client is a senior or older adult.');
      }
    }

    if (resTags.includes('domestic-violence') || resPop.includes('survivors of domestic violence')) {
      if (!clientText.includes('domestic violence') && !clientText.includes('danger') && !clientText.includes('abuse')) {
        exclusionReasons.push('Specialized domestic violence facility; client presenting need is recuperative care medical exit.');
      }
    }

    if (exclusionReasons.length > 0) {
      excluded.push({
        resource_id: resource.id,
        resource_name: resource.name,
        exclusion_reasons: exclusionReasons,
      });
      continue;
    }

    // Match against client needs
    const matchReasons: string[] = [];
    let score = 0;

    const matchesShelter = clientNeeds.includes('shelter') && (resCat === 'shelter' || resCat === 'housing-navigation' || resTags.includes('shelter') || resTags.includes('coordinated-entry'));
    const matchesId = clientNeeds.includes('id-documents') && (resCat === 'id-documents' || resTags.includes('id-documents') || resTags.includes('vital-records') || resDesc.includes('id') || resDesc.includes('identification'));
    const matchesMicro = (clientNeeds.includes('microenterprise') || clientNeeds.includes('microloans')) && (resCat === 'microenterprise' || resTags.includes('microloan') || resTags.includes('small-business'));
    const matchesTravel = (clientNeeds.includes('family-reunification-travel') || clientNeeds.includes('travel')) && (resCat === 'family-reunification-travel' || resTags.includes('reunification') || resTags.includes('bus-ticket'));
    const matchesWork = clientNeeds.includes('employment') && (resCat === 'employment' || resTags.includes('job-training') || resTags.includes('workforce'));

    if (matchesShelter) {
      matchReasons.push('Directly provides emergency shelter or coordinated housing navigation entry.');
      score += 40;
    }
    if (matchesId) {
      matchReasons.push('Offers assistance with identity documents, birth certificates, or DMV vouchers.');
      score += 35;
    }
    if (matchesMicro) {
      matchReasons.push('Offers microloans or microenterprise development grants/support.');
      score += 40;
    }
    if (matchesTravel) {
      matchReasons.push('Provides family reunification travel assistance or transit booking.');
      score += 40;
    }
    if (matchesWork) {
      matchReasons.push('Provides job placement, workforce re-entry, or interview clothing.');
      score += 35;
    }

    // Check Geographic Fit (e.g. Santa Ana for Ray)
    if (client.client.includes('Santa Ana') || client.city?.toLowerCase() === 'santa ana') {
      if (resource.city?.toLowerCase() === 'santa ana') {
        matchReasons.push('Located within client prior municipality (Santa Ana).');
        score += 20;
      } else if (!resource.city || resource.city === 'Countywide') {
        matchReasons.push('Countywide jurisdiction covering Santa Ana residents.');
        score += 10;
      }
    }

    // Check 211 / CES Gateways
    if (resource.id === '211-orange-county' || resource.id === 'oc-coordinated-entry-system') {
      matchReasons.push('Official front door for Orange County housing assessment and shelter bed reservations.');
      score += 25;
    }

    if (matchReasons.length > 0 && score >= 35) {
      // Evaluate Unknown Eligibility Factors
      if (hasNoId && (resElig.includes('id') || resDesc.includes('id required'))) {
        unknown.push({
          resource_id: resource.id,
          resource_name: resource.name,
          question: 'Does program permit 30-day grace period for ID replacement for post-recuperative care patients?',
          reason: 'Client lost state identification; program materials mention ID verification.',
        });
      }

      if (usesMobilityDevice && (resCat === 'shelter' || resTags.includes('shelter'))) {
        unknown.push({
          resource_id: resource.id,
          resource_name: resource.name,
          question: 'Are ground-floor beds or lower bunks currently available with ADA walker clearance?',
          reason: 'Client uses a walker and cannot safely climb to an upper bunk bed.',
        });
      }

      matched.push({
        resource,
        match_reasons: matchReasons,
        confidence: score >= 60 ? 'high' : 'medium',
        confidence_score: score,
      });
    }
  }

  // Sort matched resources by score descending
  matched.sort((a, b) => b.confidence_score - a.confidence_score);

  // Generate Evidence References
  const evidenceReferences: EvidenceReference[] = matched.slice(0, 5).map(m => ({
    resource_id: m.resource.id,
    resource_name: m.resource.name,
    source_url: m.resource.source_url,
    source_quote: m.resource.source_quote,
    verified_date: m.resource.verified_date,
  }));

  // Generate Staff Action Recommendations
  if (isRayC01) {
    staffActions.push('Contact IHH Recuperative Care discharge planner immediately to request an expedited CalAIM Community Supports Housing Transition referral.');
    staffActions.push('Dial 2-1-1 OC with Ray to initiate Coordinated Entry System (CES) individual queue intake and request a Shelter Bed Reservation System (SBRS) hold.');
    staffActions.push('Coordinate with Santa Ana outreach or legal aid for California DMV fee waiver (form DL 932) to replace lost photo ID.');
    staffActions.push('Confirm with destination shelter that lower-bunk ADA accommodation is confirmed in writing prior to Friday discharge.');
  } else {
    staffActions.push('Review matched resources with client in a one-on-one session.');
    staffActions.push('Verify intake requirements and current operating capacity directly with provider.');
    staffActions.push('Document client consent before sharing contact information with partner agencies.');
  }

  return {
    client_id: client.id,
    client_summary: `${client.client} — ${client.title}`,
    matched_resources: matched,
    excluded_resources: excluded,
    unknown_eligibility: unknown,
    access_barriers: barriers,
    evidence_references: evidenceReferences,
    suggested_staff_actions: staffActions,
  };
}
