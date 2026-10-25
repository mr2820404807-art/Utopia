// ===== 静态数据表（GDP/人口/工具函数）=====
// 乌托邦 · 一期改造

export const gdpMap = {
  'North Korea': 30, 'Papua New Guinea': 30, 'Greenland': 3, 'New Caledonia': 10,
  'French Polynesia': 6, 'Bermuda': 8, 'Cayman Islands': 4, 'Guam': 6, 'Aruba': 3,
  'Faroe Islands': 3, 'Jersey': 6, 'Guernsey': 4, 'Isle of Man': 8,
  'United States': 25000, 'China': 18000, 'Japan': 4200, 'Germany': 4100, 'India': 3500,
  'United Kingdom': 3100, 'France': 2800, 'Italy': 2000, 'Canada': 2100, 'Brazil': 1900,
  'South Korea': 1800, 'Australia': 1700, 'Russia': 2200, 'Mexico': 1300, 'Spain': 1400,
  'Indonesia': 1200, 'Saudi Arabia': 1100, 'Netherlands': 1000, 'Turkey': 900, 'Switzerland': 800,
  'Poland': 700, 'Argentina': 630, 'Sweden': 600, 'Belgium': 580, 'Ireland': 500,
  'Thailand': 500, 'Israel': 520, 'United Arab Emirates': 500, 'Egypt': 450, 'Singapore': 450,
  'Nigeria': 450, 'Vietnam': 400, 'Philippines': 400, 'Malaysia': 400, 'South Africa': 400,
  'Bangladesh': 420, 'Iran': 380, 'Pakistan': 350, 'Colombia': 340, 'Chile': 300,
  'Denmark': 350, 'Finland': 280, 'Romania': 290, 'Czech Republic': 280, 'Czechia': 280,
  'Portugal': 250, 'New Zealand': 250, 'Kazakhstan': 220, 'Greece': 220, 'Peru': 240,
  'Iraq': 260, 'Algeria': 190, 'Qatar': 220, 'Kuwait': 180, 'Ukraine': 160,
  'Hungary': 180, 'Ethiopia': 120, 'Kenya': 110, 'Oman': 110, 'Morocco': 130,
  'Slovakia': 110, 'Ecuador': 110, 'Dominican Republic': 110, 'Cuba': 100, 'Venezuela': 100,
  'Puerto Rico': 100, 'Sri Lanka': 75, 'Uzbekistan': 80, 'Luxembourg': 80, 'Belarus': 70,
  'Croatia': 70, 'Tanzania': 75, 'Ghana': 75, 'Ivory Coast': 70, 'Azerbaijan': 55,
  'Uganda': 45, 'Bahrain': 45, 'Jordan': 45, 'Uruguay': 70, 'Tunisia': 50,
  'Turkmenistan': 50, 'Libya': 40, 'Latvia': 40, 'Bolivia': 45, 'Paraguay': 40,
  'Slovenia': 60, 'Myanmar': 60, 'Serbia': 60, 'Zambia': 22, 'Bulgaria': 90,
  'Nepal': 40, 'Lithuania': 65, 'Cameroon': 45, 'Sudan': 35, 'Panama': 80,
  'Costa Rica': 65, 'Zimbabwe': 25, 'Mozambique': 16, 'Afghanistan': 15, 'Guinea': 16,
  'Georgia': 25, 'Botswana': 18, 'Haiti': 20, 'Jamaica': 17, 'Albania': 18,
  'Namibia': 13, 'Senegal': 28, 'Cambodia': 30, 'El Salvador': 30, 'Honduras': 30,
  'Nicaragua': 15, 'Mongolia': 15, 'Malta': 18, 'Brunei': 15, 'North Macedonia': 14,
  'Moldova': 14, 'Bosnia and Herzegovina': 23, 'Armenia': 20, 'Madagascar': 15,
  'Guyana': 15, 'Kosovo': 10, 'Kyrgyzstan': 10, 'Tajikistan': 10, 'Syria': 10,
  'Lesotho': 2, 'Taiwan': 800, 'Hong Kong': 360, 'Macau': 20, 'Niger': 15,
  'Chad': 12, 'Mali': 20, 'Burkina Faso': 20, 'Benin': 18, 'Gabon': 20,
  'Laos': 20, 'Yemen': 20, 'Lebanon': 20, 'Cyprus': 28, 'Iceland': 25,
  'Estonia': 35, 'Mauritius': 12, 'South Sudan': 5, 'Somalia': 8, 'Eritrea': 2,
  'Djibouti': 4, 'Liberia': 4, 'Sierra Leone': 4, 'Central African Republic': 3,
  'Republic of the Congo': 15, 'Democratic Republic of the Congo': 60, 'Rwanda': 12,
  'Burundi': 3, 'Malawi': 12, 'Equatorial Guinea': 12, 'Bhutan': 3, 'Timor-Leste': 2,
  'Fiji': 5, 'Guinea-Bissau': 2, 'The Gambia': 2, 'Eswatini': 4, 'Suriname': 3,
  'Belize': 3, 'Bahamas': 13, 'Trinidad and Tobago': 25, 'Barbados': 6, 'Vanuatu': 1,
  'Solomon Islands': 2, 'Samoa': 1, 'Tonga': 0.5, 'Micronesia': 0.4, 'Palau': 0.3,
  'Marshall Islands': 0.3, 'Kiribati': 0.2, 'Tuvalu': 0.1, 'Nauru': 0.1,
};

export const popMap = {
  'United States': 331000000, 'China': 1412000000, 'India': 1393000000, 'Indonesia': 274000000,
  'Pakistan': 220000000, 'Brazil': 213000000, 'Nigeria': 211000000, 'Bangladesh': 165000000,
  'Russia': 146000000, 'Mexico': 128000000, 'Japan': 126000000, 'Ethiopia': 115000000,
  'Philippines': 110000000, 'Egypt': 102000000, 'Vietnam': 97000000, 'DR Congo': 90000000,
  'Turkey': 84000000, 'Iran': 84000000, 'Germany': 83000000, 'Thailand': 70000000,
  'United Kingdom': 67000000, 'France': 67000000, 'Tanzania': 60000000, 'Italy': 60000000,
  'South Africa': 59000000, 'Myanmar': 54000000, 'Kenya': 54000000, 'South Korea': 52000000,
  'Colombia': 51000000, 'Spain': 47000000, 'Uganda': 46000000, 'Argentina': 45000000,
  'Algeria': 44000000, 'Sudan': 44000000, 'Ukraine': 44000000, 'Iraq': 40000000,
  'Poland': 38000000, 'Canada': 38000000, 'Morocco': 37000000, 'Saudi Arabia': 35000000,
  'Uzbekistan': 34000000, 'Peru': 33000000, 'Angola': 33000000, 'Malaysia': 32000000,
  'Mozambique': 31000000, 'Ghana': 31000000, 'Yemen': 30000000, 'Nepal': 29000000,
  'Venezuela': 28000000, 'Madagascar': 28000000, 'Cameroon': 27000000, "Côte d'Ivoire": 26000000,
  'North Korea': 26000000, 'Australia': 26000000, 'Taiwan': 24000000, 'Niger': 24000000,
  'Sri Lanka': 22000000, 'Burkina Faso': 21000000, 'Mali': 20000000, 'Romania': 19000000,
  'Malawi': 19000000, 'Chile': 19000000, 'Kazakhstan': 19000000, 'Guatemala': 18000000,
  'Ecuador': 18000000, 'Netherlands': 17000000, 'Cambodia': 17000000, 'Senegal': 17000000,
  'Chad': 16000000, 'Somalia': 16000000, 'Zimbabwe': 15000000, 'Guinea': 13000000,
  'Rwanda': 13000000, 'Benin': 12000000, 'Tunisia': 12000000, 'Bolivia': 12000000,
  'Belgium': 12000000, 'Cuba': 11000000, 'Burundi': 12000000, 'Jordan': 10000000,
  'Haiti': 11000000, 'Dominican Republic': 11000000, 'Czech Republic': 11000000, 'Czechia': 11000000,
  'Greece': 11000000, 'Portugal': 10000000, 'Sweden': 10000000, 'Azerbaijan': 10000000,
  'Hungary': 10000000, 'Honduras': 10000000, 'Belarus': 9000000, 'Tajikistan': 9000000,
  'Austria': 9000000, 'Papua New Guinea': 9000000, 'Serbia': 7000000, 'Israel': 9000000,
  'Switzerland': 9000000, 'Togo': 8000000, 'Hong Kong': 7500000, 'Sierra Leone': 8000000,
  'Laos': 7000000, 'Paraguay': 7000000, 'Libya': 7000000, 'Bulgaria': 7000000,
  'Nicaragua': 7000000, 'Kyrgyzstan': 7000000, 'El Salvador': 6000000, 'Turkmenistan': 6000000,
  'Singapore': 6000000, 'Denmark': 6000000, 'Finland': 6000000, 'Congo': 5000000,
  'Slovakia': 5000000, 'Norway': 5000000, 'Oman': 5000000, 'Palestine': 5000000,
  'Costa Rica': 5000000, 'Liberia': 5000000, 'Central African Republic': 5000000,
  'Ireland': 5000000, 'New Zealand': 5000000, 'Mauritania': 5000000, 'Panama': 4000000,
  'Kuwait': 4000000, 'Croatia': 4000000, 'Georgia': 4000000, 'Eritrea': 4000000,
  'Uruguay': 4000000, 'Bosnia and Herzegovina': 3000000, 'Mongolia': 3000000,
  'Armenia': 3000000, 'Jamaica': 3000000, 'Albania': 3000000, 'Qatar': 3000000,
  'Puerto Rico': 3000000, 'Lithuania': 3000000, 'Namibia': 3000000, 'Gambia': 2000000,
  'Botswana': 2000000, 'Gabon': 2000000, 'Slovenia': 2000000, 'Lesotho': 2000000,
  'Guinea-Bissau': 2000000, 'Bahrain': 2000000, 'Latvia': 2000000, 'North Macedonia': 2000000,
  'Equatorial Guinea': 1000000, 'Trinidad and Tobago': 1000000, 'Estonia': 1000000,
  'Timor-Leste': 1000000, 'Mauritius': 1000000, 'Cyprus': 1000000, 'Eswatini': 1000000,
  'Djibouti': 1000000, 'Fiji': 1000000, 'Bhutan': 1000000, 'Comoros': 1000000,
  'Guyana': 1000000, 'Malta': 1000000, 'Suriname': 1000000, 'Cape Verde': 1000000,
  'Brunei': 500000, 'Belize': 500000, 'Bahamas': 400000, 'Iceland': 400000,
  'Barbados': 300000, 'Sao Tome and Principe': 200000, 'Samoa': 200000, 'Saint Lucia': 200000,
  'Kiribati': 100000, 'Grenada': 100000, 'Tonga': 100000, 'Seychelles': 100000,
  'Antigua and Barbuda': 100000, 'Andorra': 100000, 'Dominica': 100000, 'Marshall Islands': 100000,
  'Saint Kitts and Nevis': 100000, 'Liechtenstein': 100000, 'Monaco': 100000,
  'San Marino': 100000, 'Palau': 100000, 'Nauru': 100000, 'Tuvalu': 100000, 'Vatican City': 1000,
};

// Natural Earth 里部分国家名与上表不同，做一层别名（NE NAME -> 数据表键）
export const nameAliases = {
  'United States of America': 'United States',
  'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  'Congo': 'Republic of the Congo',
  'Dominican Rep.': 'Dominican Republic',
  'Eq. Guinea': 'Equatorial Guinea',
  'S. Sudan': 'South Sudan',
  'eSwatini': 'Eswatini',
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'Solomon Is.': 'Solomon Islands',
  'Central African Rep.': 'Central African Republic',
  'Cabo Verde': 'Cape Verde',
  'São Tomé and Principe': 'Sao Tome and Principe',
  "Côte d'Ivoire": 'Ivory Coast',
  'W. Sahara': 'Western Sahara',
  'Faeroe Is.': 'Faroe Islands',
  'Cayman Is.': 'Cayman Islands',
  'Turks and Caicos Is.': 'Turks and Caicos Islands',
  'British Virgin Is.': 'British Virgin Islands',
  'U.S. Virgin Is.': 'United States Virgin Islands',
  'Marshall Is.': 'Marshall Islands',
  'N. Mariana Is.': 'Northern Mariana Islands',
  'St. Kitts and Nevis': 'Saint Kitts and Nevis',
  'St. Vin. and Gren.': 'Saint Vincent and the Grenadines',
  'Antigua and Barb.': 'Antigua and Barbuda',
  'Wallis and Futuna Is.': 'Wallis and Futuna',
  'Falkland Is.': 'Falkland Islands',
  'Fr. Polynesia': 'French Polynesia',
  'Cook Is.': 'Cook Islands',
  'Pitcairn Is.': 'Pitcairn Islands',
  'Vatican': 'Vatican City',
  'Macao': 'Macau',
};

// 国家名 -> 数据表键（带别名兜底）
export function dataKey(name) {
  return nameAliases[name] || name;
}

export const coastalCountries = new Set([
  'United States', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru',
  'United Kingdom', 'France', 'Spain', 'Portugal', 'Italy', 'Germany', 'Netherlands', 'Belgium',
  'Norway', 'Sweden', 'Denmark', 'Finland', 'Ireland', 'Iceland', 'Greece', 'Turkey',
  'Russia', 'China', 'Japan', 'South Korea', 'North Korea', 'India', 'Pakistan', 'Bangladesh',
  'Thailand', 'Vietnam', 'Indonesia', 'Philippines', 'Malaysia', 'Myanmar', 'Cambodia',
  'Australia', 'New Zealand', 'Papua New Guinea', 'Fiji',
  'Egypt', 'South Africa', 'Nigeria', 'Kenya', 'Tanzania', 'Mozambique', 'Madagascar',
  'Morocco', 'Algeria', 'Tunisia', 'Libya', 'Somalia', 'Djibouti', 'Eritrea',
  'Saudi Arabia', 'United Arab Emirates', 'Oman', 'Yemen', 'Iran', 'Iraq', 'Israel',
  'Jordan', 'Lebanon', 'Syria', 'Qatar', 'Bahrain', 'Kuwait', 'Cyprus',
  'Cuba', 'Jamaica', 'Haiti', 'Dominican Republic', 'Bahamas', 'Trinidad and Tobago',
  'Panama', 'Costa Rica', 'Honduras', 'Guatemala', 'El Salvador', 'Nicaragua', 'Belize',
  'Guyana', 'Suriname', 'Venezuela', 'Ecuador', 'Uruguay', 'Paraguay',
  'Croatia', 'Albania', 'Montenegro', 'Bosnia and Herzegovina', 'Slovenia',
  'Bulgaria', 'Romania', 'Ukraine', 'Georgia', 'Poland', 'Latvia', 'Lithuania', 'Estonia',
  'Senegal', 'Guinea', 'Guinea-Bissau', 'Sierra Leone', 'Liberia', 'Ivory Coast', 'Ghana',
  'Togo', 'Benin', 'Cameroon', 'Gabon', 'Congo', 'Equatorial Guinea', 'Angola',
  'Namibia', 'Botswana', 'Malawi', 'Zambia', 'Zimbabwe', 'Swaziland', 'Lesotho',
  'Singapore', 'Brunei', 'Taiwan', 'Hong Kong', 'Macau',
  'Sri Lanka', 'Maldives', 'Seychelles', 'Mauritius', 'Cape Verde', 'Comoros',
]);

export function nameHash(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// 两地中心点球面距离（度），用于邻接校验与海路
export function lonLatDist(a, b) {
  const dx = Math.abs(a.lon - b.lon), dy = Math.abs(a.lat - b.lat);
  // 经度跨越反经线时取短边
  const dx2 = Math.min(dx, 360 - dx);
  return Math.sqrt(dx2 * dx2 + dy * dy);
}


// ===== 政体（参照文明时代3 Governments：每种政体带国策修正）=====
export const GOV_TYPES = {
  demo:     { name: '民主制',   icon: '🗳️', incomeMod: 0.10, atkMod: -0.03, mpMod: 0.0,  diploMod: 0.15, wsDrain: 0.15, aggr: -0.2, desc: '收入+10%，外交点增长，厌战快，攻势-3%' },
  repub:    { name: '共和制',   icon: '⚖️', incomeMod: 0.04, atkMod: 0.0,   mpMod: 0.05, diploMod: 0.05, wsDrain: 0.0,  aggr: 0.0,  desc: '均衡发展：收入+4%，人力+5%' },
  monar:    { name: '君主制',   icon: '👑', incomeMod: 0.0,  atkMod: 0.04,  mpMod: 0.0,  diploMod: 0.0,  wsDrain: -0.1, aggr: 0.1, desc: '攻势+4%，厌战慢（传统王朝战争）' },
  military: { name: '军政府',   icon: '🎖️', incomeMod: -0.06, atkMod: 0.12, mpMod: 0.15, diploMod: -0.05, wsDrain: -0.2, aggr: 0.4, desc: '攻势+12%，人力+15%，收入-6%，黩武' },
  oneparty: { name: '一党制',   icon: '🚩', incomeMod: 0.06, atkMod: 0.06,  mpMod: 0.08, diploMod: 0.0,  wsDrain: -0.15, aggr: 0.2, desc: '收入+6%，攻势+6%，人力+8%，动员力强' },
};
export const GOV_KEYS = Object.keys(GOV_TYPES);
