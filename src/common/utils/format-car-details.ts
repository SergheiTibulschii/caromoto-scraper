export interface VitalCarDetails {
  vehicle: string;
  vin: string;
  titleStatus: string;
  carLink: string;
  imageUrl: string | null;

  // Formatted Strings
  odometer: string;
  conditionGrade: string;
  estimatedPrice: string;
  minimumOffer: string;
  buyNowPrice: string;

  // Custom Evaluator Labels
  evaluations: {
    mileage: string;
    grade: string;
    priceDiff: string;
    redFlags: string;
    damageHistory: string;
    paint: string;
  };

  // Raw Data (kept for reference)
  redFlagsList: string[];
}

export function extractVitalDetails(payload: any): VitalCarDetails {
  // --- UTILS ---
  const parseNum = (val: any): number | null => {
    if (!val) return null;
    const parsed = parseInt(val.toString().replace(/[^0-9.-]+/g, ''), 10);
    return isNaN(parsed) ? null : parsed;
  };

  const formatCurrency = (val: number | null): string => {
    if (val === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // --- DATA EXTRACTION ---
  const vd = payload.oldData?.vd || {};
  const autoCheck = payload.autocheckHistory || [];
  const details = payload.details || [];
  const conditionGroups = payload.conditionGroups || [];

  const accidents =
    parseNum(
      autoCheck.find((item: any) => item.label === 'Accidents')?.display,
    ) || 0;
  const titleStatus =
    details.find((item: any) => item.label === 'Title Status')?.display ||
    'Unknown';

  // Find Prior Paint & Frame Damage inside the nested condition groups
  let priorPaint = false;
  let frameDamage = false;
  conditionGroups.forEach((group: any) => {
    group.conditions?.forEach((cond: any) => {
      if (cond.label === 'Prior Paint' && cond.displays?.includes('Yes'))
        priorPaint = true;
      if (cond.label === 'Frame Damage' && cond.displays?.includes('Yes'))
        frameDamage = true;
    });
  });

  const miles = vd.uni_odometer?.value ?? null;
  const km = miles ? Math.round(miles * 1.60934) : null;
  const odometerDisplay = miles
    ? `${miles.toLocaleString('en-US')} mi / ${km?.toLocaleString('en-US')} km`
    : 'Unknown';

  const rawGrade = parseFloat(payload.grade?.display);
  const gradeDisplay = !isNaN(rawGrade) ? `${rawGrade.toFixed(1)}/5` : 'N/A';

  const estPriceNum = parseNum(vd.estimated_price);
  const minBidNum = parseNum(vd.bid_min);
  const buyNowNum = parseNum(vd.buy_now_price);
  const flagsList = vd.announcements_arr || [];

  // --- CUSTOM EVALUATIONS ---
  const evaluateMileage = () => {
    if (!km) return '⚪ Unknown';
    return km < 100000 ? '🟢 Great (Low Mileage)' : '🟡 High Mileage';
  };

  const evaluateGrade = () => {
    if (isNaN(rawGrade)) return '⚪ N/A';
    if (rawGrade >= 4.0) return '🟢 Excellent';
    if (rawGrade >= 3.0) return '🟡 Average';
    return '🔴 Poor';
  };

  const evaluatePrice = () => {
    if (!estPriceNum || !buyNowNum) return '⚪ Missing Price Data';
    const diff = buyNowNum - estPriceNum;
    const twentyPercent = estPriceNum * 0.2;
    return diff > twentyPercent
      ? '🔴 High Buy-Now Premium'
      : '🟢 Fairly Priced';
  };

  const evaluateDamage = () => {
    if (frameDamage) return '🔴 DEALBREAKER (Frame Damage)';
    if (accidents > 0) return '🟡 Has Accident History';
    return '🟢 Clean History';
  };

  const baseUrl = 'https://caromoto.com';
  const carLink = `${baseUrl}/FindVehicle?auction=${payload.auctionCode}&info_id=${payload.vehicleId}`;
  const imageUrl = payload.images?.[1]?.url.split('url=')[1] || null;

  return {
    vehicle: payload.name || 'Unknown Vehicle',
    vin: payload.vin?.vin || 'Unknown VIN',
    titleStatus: titleStatus,
    carLink,
    imageUrl,

    odometer: odometerDisplay,
    conditionGrade: gradeDisplay,
    estimatedPrice: formatCurrency(estPriceNum),
    minimumOffer: formatCurrency(minBidNum),
    buyNowPrice: formatCurrency(buyNowNum),

    evaluations: {
      mileage: evaluateMileage(),
      grade: evaluateGrade(),
      priceDiff: evaluatePrice(),
      redFlags: flagsList.length === 0 ? '🟢 Clean' : '🔴 Caution Required',
      damageHistory: evaluateDamage(),
      paint: priorPaint ? '🟡 Repainted' : '🟢 Original Paint',
    },

    redFlagsList: flagsList,
  };
}
