function createBorderOverlay() {
  const countryCanvas = document.createElement('canvas');
  countryCanvas.width = 8192; countryCanvas.height = 4096;
  const cctx = countryCanvas.getContext('2d');
  const provinceCanvas = document.createElement('canvas');
  provinceCanvas.width = 8192; provinceCanvas.height = 4096;
  const pctx = provinceCanvas.getContext('2d');

  const countriesUrl = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson';
  const provincesUrl = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_1_states_provinces.geojson';

  Promise.all([
    fetch(countriesUrl).then(r => r.json()),
    fetch(provincesUrl).then(r => r.json()),
  ])
  .then(([countries, provinces]) => {
    function toCanvas(lon, lat, w, h) { return [(lon + 180) / 360 * w, (90 - lat) / 180 * h]; }
    function drawGeoJSON(geojson, ctx, w, h) {
      geojson.features.forEach(feature => {
        const geom = feature.geometry;
        if (!geom) return;
        function drawRing(ring) {
          if (ring.length < 2) return;
          ctx.beginPath();
          const [sx, sy] = toCanvas(ring[0][0], ring[0][1], w, h);
          ctx.moveTo(sx, sy);
          for (let i = 1; i < ring.length; i++) {
            const [px, py] = toCanvas(ring[i][0], ring[i][1], w, h);
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        if (geom.type === 'Polygon') geom.coordinates.forEach(drawRing);
        else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(poly => poly.forEach(drawRing));
      });
    }

    pctx.strokeStyle = 'rgba(0,0,0,1.0)';
    pctx.lineWidth = 0.9;
    pctx.lineJoin = 'round';
    drawGeoJSON(provinces, pctx, provinceCanvas.width, provinceCanvas.height);

    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = 8192; colorCanvas.height = 4096;
    const colorCtx = colorCanvas.getContext('2d');

    function genPalette(n) {
      const cols = [];
      for (let i = 0; i < n; i++) { const h = (i * 137.508) % 360; cols.push(`hsla(${h},50%,58%,0.25)`); }
      return cols;
    }
    const PALETTE = genPalette(24);
    const countryFeatures = countries.features.filter(f => { const n = f.properties.NAME || ''; return n && n !== 'Antarctica'; });

    const adj = {};
    function getBBox(geometry) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      function scan(coords) {
        for (const c of coords) {
          if (Array.isArray(c[0])) scan(c);
          else { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); }
        }
      }
      scan(geometry.coordinates);
      return { minX, maxX, minY, maxY };
    }

    const bboxes = countryFeatures.map(f => ({ name: f.properties.NAME, bbox: getBBox(f.geometry) }));
    for (let i = 0; i < bboxes.length; i++) {
      for (let j = i + 1; j < bboxes.length; j++) {
        const a = bboxes[i], b = bboxes[j];
        if (a.bbox.maxX < b.bbox.minX - 1 || b.bbox.maxX < a.bbox.minX - 1) continue;
        if (a.bbox.maxY < b.bbox.minY - 1 || b.bbox.maxY < a.bbox.minY - 1) continue;
        if (!adj[a.name]) adj[a.name] = new Set();
        if (!adj[b.name]) adj[b.name] = new Set();
        adj[a.name].add(b.name);
        adj[b.name].add(a.name);
      }
    }

    const countryColors = {};
    const sorted = countryFeatures.map(f => f.properties.NAME).sort((a, b) => (adj[b]?.size || 0) - (adj[a]?.size || 0));
    for (const name of sorted) {
      const used = new Set();
      for (const neighbor of (adj[name] || [])) { if (countryColors[neighbor]) used.add(countryColors[neighbor]); }
      let ci = 0;
      while (used.has(PALETTE[ci])) ci++;
      countryColors[name] = PALETTE[ci % PALETTE.length];
    }
    countryColors['Taiwan'] = countryColors['China'];

    function drawFilledGeoJSON(geojson, ctx, w, h) {
      geojson.features.forEach(feature => {
        const geom = feature.geometry;
        if (!geom) return;
        const name = feature.properties.NAME || feature.properties.name || '';
        if (name === 'Antarctica') return;
        ctx.fillStyle = countryColors[name] || PALETTE[0];
        ctx.strokeStyle = 'transparent';
        ctx.lineWidth = 0;
        function drawRing(ring) {
          if (ring.length < 2) return;
          ctx.beginPath();
          const [sx, sy] = toCanvas(ring[0][0], ring[0][1], w, h);
          ctx.moveTo(sx, sy);
          for (let i = 1; i < ring.length; i++) {
            const [px, py] = toCanvas(ring[i][0], ring[i][1], w, h);
            ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
        if (geom.type === 'Polygon') geom.coordinates.forEach(drawRing);
        else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(poly => poly.forEach(drawRing));
      });
    }
    drawFilledGeoJSON(countries, colorCtx, colorCanvas.width, colorCanvas.height);

    const colorTex = new THREE.CanvasTexture(colorCanvas);
    colorTex.colorSpace = THREE.SRGBColorSpace;
    colorTex.anisotropy = 8;
    const colorGeo = new THREE.SphereGeometry(1.004, 128, 128);
    const colorSphere = new THREE.Mesh(colorGeo, new THREE.MeshBasicMaterial({
      map: colorTex, transparent: true, depthTest: true, depthWrite: false,
    }));
    colorSphere.name = 'countryColors';
    const oldColor = earthGroup.getObjectByName('countryColors');
    if (oldColor) earthGroup.remove(oldColor);
    earthGroup.add(colorSphere);
    window.__colorSphereMat = colorSphere.material;

    cctx.strokeStyle = 'rgba(0,0,0,1.0)';
    cctx.lineWidth = 1.5;
    cctx.lineJoin = 'round';
    drawGeoJSON(countries, cctx, countryCanvas.width, countryCanvas.height);

    const countryTex = new THREE.CanvasTexture(countryCanvas);
    countryTex.colorSpace = THREE.SRGBColorSpace;
    countryTex.anisotropy = 8;
    const borderGeo = new THREE.SphereGeometry(1.005, 128, 128);
    const countrySphere = new THREE.Mesh(borderGeo, new THREE.MeshBasicMaterial({
      map: countryTex, transparent: true, opacity: 0.85, depthTest: true, depthWrite: false,
    }));
    countrySphere.name = 'countryBorders';
    const oldC = earthGroup.getObjectByName('countryBorders');
    if (oldC) earthGroup.remove(oldC);
    earthGroup.add(countrySphere);

    const provinceTex = new THREE.CanvasTexture(provinceCanvas);
    provinceTex.colorSpace = THREE.SRGBColorSpace;
    provinceTex.anisotropy = 8;
    const provinceGeo = new THREE.SphereGeometry(1.006, 128, 128);
    const provinceMat = new THREE.MeshBasicMaterial({
      map: provinceTex, transparent: true, opacity: 0.0, depthTest: true, depthWrite: false,
    });
    const provinceSphere = new THREE.Mesh(provinceGeo, provinceMat);
    provinceSphere.name = 'provinceBorders';
    const oldP = earthGroup.getObjectByName('provinceBorders');
    if (oldP) earthGroup.remove(oldP);
    earthGroup.add(provinceSphere);
    window.__provinceBorderMat = provinceMat;

    const oldLabels = earthGroup.getObjectByName('labels');
    if (oldLabels) earthGroup.remove(oldLabels);
    const labelGroup = new THREE.Group();
    labelGroup.name = 'labels';

    function latLonToVec3(lat, lon, r) {
      const phi = (90 - lat) * Math.PI / 180;
      const theta = (lon + 180) * Math.PI / 180;
      return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    }

    function ringCentroid(ring) {
      let cx = 0, cy = 0, area = 0, n = ring.length;
      for (let i = 0; i < n - 1; i++) {
        const x0 = ring[i][0], y0 = ring[i][1];
        const x1 = ring[i + 1][0], y1 = ring[i + 1][1];
        const a = x0 * y1 - x1 * y0;
        area += a;
        cx += (x0 + x1) * a;
        cy += (y0 + y1) * a;
      }
      area /= 2;
      if (Math.abs(area) < 1) return null;
      return [cx / (6 * area), cy / (6 * area), Math.abs(area)];
    }

    function pointInRing(lon, lat, ring) {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)
          inside = !inside;
      }
      return inside;
    }

    function ensureInside(clon, clat, ring) {
      if (pointInRing(clon, clat, ring)) return [clon, clat];
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [x, y] of ring) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      let best = null, bestDist = Infinity;
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        for (let j = 0; j <= steps; j++) {
          const x = minX + (maxX - minX) * i / steps;
          const y = minY + (maxY - minY) * j / steps;
          if (pointInRing(x, y, ring)) {
            const d = (x - clon) * (x - clon) + (y - clat) * (y - clat);
            if (d < bestDist) { bestDist = d; best = [x, y]; }
          }
        }
      }
      return best || [clon, clat];
    }

    const chineseNames = {
      'Afghanistan': '阿富汗', 'Albania': '阿尔巴尼亚', 'Algeria': '阿尔及利亚',
      'Angola': '安哥拉', 'Argentina': '阿根廷', 'Armenia': '亚美尼亚',
      'Australia': '澳大利亚', 'Austria': '奥地利', 'Azerbaijan': '阿塞拜疆',
      'Bahamas': '巴哈马', 'Bangladesh': '孟加拉国', 'Belarus': '白俄罗斯',
      'Belgium': '比利时', 'Belize': '伯利兹', 'Benin': '贝宁', 'Bhutan': '不丹',
      'Bolivia': '玻利维亚', 'Bosnia and Herzegovina': '波黑',
      'Botswana': '博茨瓦纳', 'Brazil': '巴西', 'Brunei': '文莱',
      'Bulgaria': '保加利亚', 'Burkina Faso': '布基纳法索', 'Burundi': '布隆迪',
      'Cambodia': '柬埔寨', 'Cameroon': '喀麦隆', 'Canada': '加拿大',
      'Central African Republic': '中非', 'Chad': '乍得', 'Chile': '智利',
      'China': '中国', 'Colombia': '哥伦比亚', 'Congo': '刚果(布)',
      'Costa Rica': '哥斯达黎加', "Côte d'Ivoire": '科特迪瓦', 'Croatia': '克罗地亚',
      'Cuba': '古巴', 'Cyprus': '塞浦路斯', 'Czech Republic': '捷克',
      'Czechia': '捷克', 'Dem. Rep. Congo': '刚果(金)', 'Denmark': '丹麦',
      'Djibouti': '吉布提', 'Dominican Republic': '多米尼加',
      'Ecuador': '厄瓜多尔', 'Egypt': '埃及', 'El Salvador': '萨尔瓦多',
      'Equatorial Guinea': '赤道几内亚', 'Eritrea': '厄立特里亚',
      'Estonia': '爱沙尼亚', 'Ethiopia': '埃塞俄比亚', 'Fiji': '斐济',
      'Finland': '芬兰', 'France': '法国', 'Gabon': '加蓬', 'Gambia': '冈比亚',
      'Georgia': '格鲁吉亚', 'Germany': '德国', 'Ghana': '加纳',
      'Greece': '希腊', 'Greenland': '格陵兰', 'Guatemala': '危地马拉',
      'Guinea': '几内亚', 'Guinea-Bissau': '几内亚比绍', 'Guyana': '圭亚那',
      'Haiti': '海地', 'Honduras': '洪都拉斯', 'Hungary': '匈牙利',
      'Iceland': '冰岛', 'India': '印度', 'Indonesia': '印度尼西亚',
      'Iran': '伊朗', 'Iraq': '伊拉克', 'Ireland': '爱尔兰',
      'Israel': '以色列', 'Italy': '意大利', 'Jamaica': '牙买加',
      'Japan': '日本', 'Jordan': '约旦', 'Kazakhstan': '哈萨克斯坦',
      'Kenya': '肯尼亚', 'Kosovo': '科索沃', 'Kuwait': '科威特',
      'Kyrgyzstan': '吉尔吉斯斯坦', 'Laos': '老挝', 'Latvia': '拉脱维亚',
      'Lebanon': '黎巴嫩', 'Lesotho': '莱索托', 'Liberia': '利比里亚',
      'Libya': '利比亚', 'Lithuania': '立陶宛', 'Luxembourg': '卢森堡',
      'Madagascar': '马达加斯加', 'Malawi': '马拉维', 'Malaysia': '马来西亚',
      'Mali': '马里', 'Mauritania': '毛里塔尼亚', 'Mexico': '墨西哥',
      'Moldova': '摩尔多瓦', 'Mongolia': '蒙古', 'Montenegro': '黑山',
      'Morocco': '摩洛哥', 'Mozambique': '莫桑比克',
      'Myanmar': '缅甸', 'Namibia': '纳米比亚', 'Nepal': '尼泊尔',
      'Netherlands': '荷兰', 'New Zealand': '新西兰', 'Nicaragua': '尼加拉瓜',
      'Niger': '尼日尔', 'Nigeria': '尼日利亚', 'North Korea': '朝鲜',
      'North Macedonia': '北马其顿', 'Norway': '挪威', 'Oman': '阿曼',
      'Pakistan': '巴基斯坦', 'Panama': '巴拿马',
      'Papua New Guinea': '巴布亚新几内亚', 'Paraguay': '巴拉圭',
      'Peru': '秘鲁', 'Philippines': '菲律宾', 'Poland': '波兰',
      'Portugal': '葡萄牙', 'Qatar': '卡塔尔', 'Republic of Serbia': '塞尔维亚',
      'Romania': '罗马尼亚', 'Russia': '俄罗斯', 'Russian Federation': '俄罗斯',
      'Rwanda': '卢旺达', 'Saudi Arabia': '沙特', 'Senegal': '塞内加尔',
      'Serbia': '塞尔维亚', 'Sierra Leone': '塞拉利昂', 'Slovakia': '斯洛伐克',
      'Slovenia': '斯洛文尼亚', 'Solomon Islands': '所罗门群岛',
      'Somalia': '索马里', 'South Africa': '南非', 'South Korea': '韩国',
      'South Sudan': '南苏丹', 'Spain': '西班牙', 'Sri Lanka': '斯里兰卡',
      'Sudan': '苏丹', 'Suriname': '苏里南', 'Sweden': '瑞典',
      'Switzerland': '瑞士', 'Syria': '叙利亚', 'Tajikistan': '塔吉克斯坦',
      'Tanzania': '坦桑尼亚', 'Thailand': '泰国', 'Taiwan': '台湾',
      'Timor-Leste': '东帝汶', 'Togo': '多哥',
      'Trinidad and Tobago': '特立尼达', 'Tunisia': '突尼斯',
      'Turkey': '土耳其', 'Turkmenistan': '土库曼斯坦', 'Uganda': '乌干达',
      'Ukraine': '乌克兰', 'United Arab Emirates': '阿联酋',
      'United Kingdom': '英国', 'United States': '美国',
      'United States of America': '美国', 'Uruguay': '乌拉圭',
      'Uzbekistan': '乌兹别克斯坦', 'Venezuela': '委内瑞拉',
      'Vietnam': '越南', 'Yemen': '也门', 'Zambia': '赞比亚',
      'Zimbabwe': '津巴布韦', 'eSwatini': '斯威士兰', 'Swaziland': '斯威士兰',
      'W. Sahara': '西撒哈拉', 'Western Sahara': '西撒哈拉',
      'Somaliland': '索马里兰', 'N. Cyprus': '北塞浦路斯',
      'Federated States of Micronesia': '密克罗尼西亚',
      'Palestine': '巴勒斯坦', 'Puerto Rico': '波多黎各',
      'Antarctica': '南极洲',
      'Bosnia and Herz.': '波黑', 'Central African Rep.': '中非',
      'Dominican Rep.': '多米尼加', 'Eq. Guinea': '赤道几内亚',
      'Falkland Is.': '福克兰群岛', 'Fr. S. Antarctic Lands': '法属南部领地',
      'New Caledonia': '新喀里多尼亚', 'S. Sudan': '南苏丹',
      'Solomon Is.': '所罗门群岛', 'Vanuatu': '瓦努阿图',
      'Singapore': '新加坡', 'Brunei': '文莱',
    };
    window.__chineseNames = chineseNames;

    const fullChineseNames = {
      'Afghanistan': '阿富汗伊斯兰共和国', 'Albania': '阿尔巴尼亚共和国', 'Algeria': '阿尔及利亚民主人民共和国',
      'Angola': '安哥拉共和国', 'Argentina': '阿根廷共和国', 'Armenia': '亚美尼亚共和国',
      'Australia': '澳大利亚联邦', 'Austria': '奥地利共和国', 'Azerbaijan': '阿塞拜疆共和国',
      'Bahamas': '巴哈马联邦', 'Bangladesh': '孟加拉人民共和国', 'Belarus': '白俄罗斯共和国',
      'Belgium': '比利时王国', 'Belize': '伯利兹', 'Benin': '贝宁共和国', 'Bhutan': '不丹王国',
      'Bolivia': '多民族玻利维亚国', 'Bosnia and Herzegovina': '波斯尼亚和黑塞哥维那',
      'Botswana': '博茨瓦纳共和国', 'Brazil': '巴西联邦共和国', 'Brunei': '文莱达鲁萨兰国',
      'Bulgaria': '保加利亚共和国', 'Burkina Faso': '布基纳法索', 'Burundi': '布隆迪共和国',
      'Cambodia': '柬埔寨王国', 'Cameroon': '喀麦隆共和国', 'Canada': '加拿大',
      'Central African Republic': '中非共和国', 'Chad': '乍得共和国', 'Chile': '智利共和国',
      'China': '中华人民共和国', 'Colombia': '哥伦比亚共和国', 'Congo': '刚果共和国',
      'Costa Rica': '哥斯达黎加共和国', "Côte d'Ivoire": '科特迪瓦共和国', 'Croatia': '克罗地亚共和国',
      'Cuba': '古巴共和国', 'Cyprus': '塞浦路斯共和国', 'Czech Republic': '捷克共和国',
      'Czechia': '捷克共和国', 'Dem. Rep. Congo': '刚果民主共和国', 'Denmark': '丹麦王国',
      'Djibouti': '吉布提共和国', 'Dominican Republic': '多米尼加共和国',
      'Ecuador': '厄瓜多尔共和国', 'Egypt': '阿拉伯埃及共和国', 'El Salvador': '萨尔瓦多共和国',
      'Equatorial Guinea': '赤道几内亚共和国', 'Eritrea': '厄立特里亚国',
      'Estonia': '爱沙尼亚共和国', 'Ethiopia': '埃塞俄比亚联邦民主共和国', 'Fiji': '斐济共和国',
      'Finland': '芬兰共和国', 'France': '法兰西共和国', 'Gabon': '加蓬共和国', 'Gambia': '冈比亚共和国',
      'Georgia': '格鲁吉亚', 'Germany': '德意志联邦共和国', 'Ghana': '加纳共和国',
      'Greece': '希腊共和国', 'Greenland': '格陵兰', 'Guatemala': '危地马拉共和国',
      'Guinea': '几内亚共和国', 'Guinea-Bissau': '几内亚比绍共和国', 'Guyana': '圭亚那合作共和国',
      'Haiti': '海地共和国', 'Honduras': '洪都拉斯共和国', 'Hungary': '匈牙利',
      'Iceland': '冰岛共和国', 'India': '印度共和国', 'Indonesia': '印度尼西亚共和国',
      'Iran': '伊朗伊斯兰共和国', 'Iraq': '伊拉克共和国', 'Ireland': '爱尔兰',
      'Israel': '以色列国', 'Italy': '意大利共和国', 'Jamaica': '牙买加',
      'Japan': '日本国', 'Jordan': '约旦哈希姆王国', 'Kazakhstan': '哈萨克斯坦共和国',
      'Kenya': '肯尼亚共和国', 'Kosovo': '科索沃', 'Kuwait': '科威特国',
      'Kyrgyzstan': '吉尔吉斯共和国', 'Laos': '老挝人民民主共和国', 'Latvia': '拉脱维亚共和国',
      'Lebanon': '黎巴嫩共和国', 'Lesotho': '莱索托王国', 'Liberia': '利比里亚共和国',
      'Libya': '利比亚国', 'Lithuania': '立陶宛共和国', 'Luxembourg': '卢森堡大公国',
      'Madagascar': '马达加斯加共和国', 'Malawi': '马拉维共和国', 'Malaysia': '马来西亚',
      'Mali': '马里共和国', 'Mauritania': '毛里塔尼亚伊斯兰共和国', 'Mexico': '墨西哥合众国',
      'Moldova': '摩尔多瓦共和国', 'Mongolia': '蒙古国', 'Montenegro': '黑山',
      'Morocco': '摩洛哥王国', 'Mozambique': '莫桑比克共和国',
      'Myanmar': '缅甸联邦共和国', 'Namibia': '纳米比亚共和国', 'Nepal': '尼泊尔联邦民主共和国',
      'Netherlands': '荷兰王国', 'New Zealand': '新西兰', 'Nicaragua': '尼加拉瓜共和国',
      'Niger': '尼日尔共和国', 'Nigeria': '尼日利亚联邦共和国', 'North Korea': '朝鲜民主主义人民共和国',
      'North Macedonia': '北马其顿共和国', 'Norway': '挪威王国', 'Oman': '阿曼苏丹国',
      'Pakistan': '巴基斯坦伊斯兰共和国', 'Panama': '巴拿马共和国',
      'Papua New Guinea': '巴布亚新几内亚独立国', 'Paraguay': '巴拉圭共和国',
      'Peru': '秘鲁共和国', 'Philippines': '菲律宾共和国', 'Poland': '波兰共和国',
      'Portugal': '葡萄牙共和国', 'Qatar': '卡塔尔国', 'Republic of Serbia': '塞尔维亚共和国',
      'Romania': '罗马尼亚', 'Russia': '俄罗斯联邦', 'Russian Federation': '俄罗斯联邦',
      'Rwanda': '卢旺达共和国', 'Saudi Arabia': '沙特阿拉伯王国', 'Senegal': '塞内加尔共和国',
      'Serbia': '塞尔维亚共和国', 'Sierra Leone': '塞拉利昂共和国', 'Slovakia': '斯洛伐克共和国',
      'Slovenia': '斯洛文尼亚共和国', 'Solomon Islands': '所罗门群岛',
      'Somalia': '索马里联邦共和国', 'South Africa': '南非共和国', 'South Korea': '大韩民国',
      'South Sudan': '南苏丹共和国', 'Spain': '西班牙王国', 'Sri Lanka': '斯里兰卡民主社会主义共和国',
      'Sudan': '苏丹共和国', 'Suriname': '苏里南共和国', 'Sweden': '瑞典王国',
      'Switzerland': '瑞士联邦', 'Syria': '阿拉伯叙利亚共和国', 'Tajikistan': '塔吉克斯坦共和国',
      'Tanzania': '坦桑尼亚联合共和国', 'Thailand': '泰王国',
      'Timor-Leste': '东帝汶民主共和国', 'Togo': '多哥共和国',
      'Trinidad and Tobago': '特立尼达和多巴哥共和国', 'Tunisia': '突尼斯共和国',
      'Turkey': '土耳其共和国', 'Turkmenistan': '土库曼斯坦', 'Uganda': '乌干达共和国',
      'Ukraine': '乌克兰', 'United Arab Emirates': '阿拉伯联合酋长国',
      'United Kingdom': '大不列颠及北爱尔兰联合王国', 'United States': '美利坚合众国',
      'United States of America': '美利坚合众国', 'Uruguay': '乌拉圭东岸共和国',
      'Uzbekistan': '乌兹别克斯坦共和国', 'Venezuela': '委内瑞拉玻利瓦尔共和国',
      'Vietnam': '越南社会主义共和国', 'Yemen': '也门共和国', 'Zambia': '赞比亚共和国',
      'Zimbabwe': '津巴布韦共和国', 'eSwatini': '埃斯瓦蒂尼王国', 'Swaziland': '埃斯瓦蒂尼王国',
      'W. Sahara': '阿拉伯撒哈拉民主共和国', 'Western Sahara': '阿拉伯撒哈拉民主共和国',
      'Somaliland': '索马里兰共和国', 'N. Cyprus': '北塞浦路斯土耳其共和国',
      'Federated States of Micronesia': '密克罗尼西亚联邦',
      'Palestine': '巴勒斯坦国', 'Puerto Rico': '波多黎各自由邦',
      'Antarctica': '南极洲',
      'Bosnia and Herz.': '波斯尼亚和黑塞哥维那', 'Central African Rep.': '中非共和国',
      'Dominican Rep.': '多米尼加共和国', 'Eq. Guinea': '赤道几内亚共和国',
      'Falkland Is.': '福克兰群岛', 'Fr. S. Antarctic Lands': '法国南部和南极领地',
      'New Caledonia': '新喀里多尼亚', 'S. Sudan': '南苏丹共和国',
      'Solomon Is.': '所罗门群岛', 'Taiwan': '中国台湾省', 'Vanuatu': '瓦努阿图共和国',
    };
    window.__fullChineseNames = fullChineseNames;

    countries.features.forEach(f => {
      const name = f.properties.NAME || '';
      if (name && !fullChineseNames[name] && chineseNames[name]) fullChineseNames[name] = chineseNames[name];
    });

    const countryCodeMap = {
      'Afghanistan':'AF','Albania':'AL','Algeria':'DZ','Angola':'AO','Argentina':'AR',
      'Armenia':'AM','Australia':'AU','Austria':'AT','Azerbaijan':'AZ','Bahamas':'BS',
      'Bangladesh':'BD','Belarus':'BY','Belgium':'BE','Belize':'BZ','Benin':'BJ',
      'Bhutan':'BT','Bolivia':'BO','Bosnia and Herzegovina':'BA','Botswana':'BW',
      'Brazil':'BR','Brunei':'BN','Bulgaria':'BG','Burkina Faso':'BF','Burundi':'BI',
      'Cambodia':'KH','Cameroon':'CM','Canada':'CA','Central African Republic':'CF',
      'Chad':'TD','Chile':'CL','China':'CN','Colombia':'CO','Congo':'CG',
      'Costa Rica':'CR',"Côte d'Ivoire":'CI','Croatia':'HR','Cuba':'CU','Cyprus':'CY','N. Cyprus':'TR',
      'Czech Republic':'CZ','Czechia':'CZ','Dem. Rep. Congo':'CD','Denmark':'DK',
      'Djibouti':'DJ','Dominican Republic':'DO','Dominican Rep.':'DO','Ecuador':'EC','Egypt':'EG',
      'El Salvador':'SV','Equatorial Guinea':'GQ','Eritrea':'ER','Estonia':'EE',
      'Ethiopia':'ET','Fiji':'FJ','Finland':'FI','France':'FR','Fr. S. Antarctic Lands':'TF','Gabon':'GA',
      'Gambia':'GM','Georgia':'GE','Germany':'DE','Ghana':'GH','Greece':'GR',
      'Greenland':'GL','Guatemala':'GT','Guinea':'GN','Guinea-Bissau':'GW',
      'Guyana':'GY','Haiti':'HT','Honduras':'HN','Hungary':'HU','Iceland':'IS',
      'India':'IN','Indonesia':'ID','Iran':'IR','Iraq':'IQ','Ireland':'IE',
      'Israel':'IL','Italy':'IT','Jamaica':'JM','Japan':'JP','Jordan':'JO',
      'Kazakhstan':'KZ','Kenya':'KE','Kosovo':'XK','Kuwait':'KW',
      'Kyrgyzstan':'KG','Laos':'LA','Latvia':'LV','Lebanon':'LB','Lesotho':'LS',
      'Liberia':'LR','Libya':'LY','Lithuania':'LT','Luxembourg':'LU',
      'Madagascar':'MG','Malawi':'MW','Malaysia':'MY','Mali':'ML',
      'Mauritania':'MR','Mexico':'MX','Moldova':'MD','Mongolia':'MN',
      'Montenegro':'ME','Morocco':'MA','Mozambique':'MZ','Myanmar':'MM',
      'Namibia':'NA','Nepal':'NP','Netherlands':'NL','New Zealand':'NZ',
      'Nicaragua':'NI','Niger':'NE','Nigeria':'NG','North Korea':'KP',
      'North Macedonia':'MK','Norway':'NO','Oman':'OM','Pakistan':'PK',
      'Panama':'PA','Papua New Guinea':'PG','Paraguay':'PY','Peru':'PE',
      'Philippines':'PH','Poland':'PL','Portugal':'PT','Qatar':'QA',
      'Republic of Serbia':'RS','Romania':'RO','Russia':'RU',
      'Russian Federation':'RU','Rwanda':'RW','Saudi Arabia':'SA','Senegal':'SN',
      'Serbia':'RS','Sierra Leone':'SL','Slovakia':'SK','Slovenia':'SI',
      'Solomon Islands':'SB','Somalia':'SO','South Africa':'ZA','South Korea':'KR',
      'South Sudan':'SS','Spain':'ES','Sri Lanka':'LK','Sudan':'SD',
      'Suriname':'SR','Sweden':'SE','Switzerland':'CH','Syria':'SY',
      'Tajikistan':'TJ','Tanzania':'TZ','Thailand':'TH','Timor-Leste':'TL',
      'Togo':'TG','Trinidad and Tobago':'TT','Tunisia':'TN','Turkey':'TR',
      'Turkmenistan':'TM','Uganda':'UG','Ukraine':'UA',
      'United Arab Emirates':'AE','United Kingdom':'GB','United States':'US',
      'United States of America':'US','Uruguay':'UY','Uzbekistan':'UZ',
      'Venezuela':'VE','Vietnam':'VN','Yemen':'YE','Zambia':'ZM',
      'Zimbabwe':'ZW','eSwatini':'SZ','Swaziland':'SZ','W. Sahara':'EH',
      'Western Sahara':'EH','Palestine':'PS','Puerto Rico':'PR',
      'Bosnia and Herz.':'BA','Central African Rep.':'CF',
      'Dominican Rep.':'DO','Eq. Guinea':'GQ',
      'Falkland Is.':'FK','Fr. S. Antarctic Lands':'TF',
      'New Caledonia':'NC','S. Sudan':'SS',
      'Solomon Is.':'SB','Vanuatu':'VU',
      'Singapore':'SG','Brunei':'BN',
    };
    window.__countryCodeMap = countryCodeMap;

    const allLabels = [];
    const candidates = [];
    countries.features.forEach(feature => {
      const name = feature.properties.NAME || feature.properties.name || '';
      if (!name || name === 'Antarctica' || name === 'Taiwan') return;
      const geom = feature.geometry;
      if (!geom) return;
      let bestCentroid = null, bestArea = 0, bestRing = null;
      const rings = [];
      if (geom.type === 'Polygon') rings.push(geom.coordinates[0]);
      else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => rings.push(p[0]));
      for (const ring of rings) {
        const c = ringCentroid(ring);
        if (c && c[2] > bestArea) { bestArea = c[2]; bestCentroid = c; bestRing = ring; }
      }
      if (!bestCentroid || bestArea < 0.001) return;
      const [clon, clat] = ensureInside(bestCentroid[0], bestCentroid[1], bestRing);
      candidates.push({ name, clon, clat, bestArea });
    });
    const maxArea = Math.max(...candidates.map(c => c.bestArea));

    candidates.forEach(({ name, clon, clat, bestArea }) => {
      const logFrac = Math.log(bestArea + 1) / Math.log(maxArea + 1);
      const scale = Math.max(0.15, 0.05 + 0.95 * Math.pow(logFrac, 0.6));
      const geoW = 0.45 * scale;
      const geoH = 0.065 * scale;
      const displayName = chineseNames[name] || name;
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 512; labelCanvas.height = 64;
      const lctx = labelCanvas.getContext('2d');
      const areaScore = Math.log(bestArea + 1) / Math.log(maxArea + 1);
      const fontSize = areaScore <= 0.15 ? Math.round(8 + 20 * Math.sqrt(scale)) : areaScore <= 0.3 ? Math.round(14 + 28 * Math.sqrt(scale)) : Math.round(20 + 36 * Math.sqrt(scale));
      lctx.font = `bold ${fontSize}px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif`;
      lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
      lctx.strokeStyle = 'rgba(0,0,0,0.9)'; lctx.lineWidth = 3; lctx.lineJoin = 'round';
      lctx.strokeText(displayName, 256, 32);
      lctx.fillStyle = 'rgba(140,165,195,0.65)'; lctx.fillText(displayName, 256, 32);

      const LABEL_R = 1.013;
      const sH = 4, sW = Math.max(2, Math.round(4 * geoW / geoH));
      const flatGeo = new THREE.PlaneGeometry(geoW, geoH, sW, sH);
      const fPos = flatGeo.attributes.position;
      for (let i = 0; i < fPos.count; i++) {
        const x = fPos.getX(i), y = fPos.getY(i);
        const d = Math.sqrt(x*x + y*y + LABEL_R*LABEL_R);
        fPos.setXYZ(i, x * LABEL_R / d, y * LABEL_R / d, LABEL_R * LABEL_R / d - LABEL_R);
      }
      flatGeo.computeVertexNormals();

      const labelMat = new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(labelCanvas),
        transparent: true, side: THREE.DoubleSide, depthTest: true, depthWrite: false,
      });
      const labelMesh = new THREE.Mesh(flatGeo, labelMat);
      const pos = latLonToVec3(clat, clon, 1.013);
      labelMesh.position.copy(pos);
      const normal = pos.clone().normalize();
      const worldUp = new THREE.Vector3(0, 1, 0);
      if (Math.abs(normal.dot(worldUp)) > 0.999) {
        labelMesh.lookAt(pos.clone().add(new THREE.Vector3(0, 0, 1)));
      } else {
        const east = new THREE.Vector3().crossVectors(worldUp, normal).normalize();
        const north = new THREE.Vector3().crossVectors(normal, east).normalize();
        labelMesh.setRotationFromMatrix(new THREE.Matrix4().makeBasis(east, north, normal));
      }
      labelGroup.add(labelMesh);
      allLabels.push({ mesh: labelMesh, area: bestArea });
    });

    earthGroup.add(labelGroup);
    window.__allLabels = allLabels;
    window.__maxLabelArea = maxArea;
    window.__countriesGeoJSON = countries;
    window.__provincesGeoJSON = provinces;

    const taiwanCountryFeature = countries.features.find(f => f.properties.NAME === 'Taiwan');
    let taiwanProvinceFeature = provinces.features.find(f => {
      const n = f.properties.name || f.properties.NAME || '';
      return n === 'Taiwan' || n === 'Taiwan Province';
    });
    if (taiwanCountryFeature) {
      if (!taiwanProvinceFeature) {
        taiwanProvinceFeature = { type: 'Feature', properties: { name: 'Taiwan', admin: 'China' }, geometry: taiwanCountryFeature.geometry };
      } else {
        taiwanProvinceFeature = { ...taiwanProvinceFeature, properties: { ...taiwanProvinceFeature.properties, name: 'Taiwan', admin: 'China' } };
        delete taiwanProvinceFeature.properties.NAME;
      }
    }
    window.__taiwanCountryFeature = taiwanCountryFeature;
    window.__taiwanProvinceFeature = taiwanProvinceFeature;

    const capitalCoords = {
      'Afghanistan':[34.53,69.17],'Albania':[41.33,19.82],'Algeria':[36.75,3.04],
      'Angola':[-8.84,13.23],'Argentina':[-34.6,-58.38],'Armenia':[40.18,44.51],
      'Australia':[-35.28,149.13],'Austria':[48.21,16.37],'Azerbaijan':[40.41,49.87],
      'Bahamas':[25.05,-77.34],'Bangladesh':[23.81,90.41],'Belarus':[53.9,27.57],
      'Belgium':[50.85,4.35],'Belize':[17.18,-88.5],'Benin':[6.49,2.63],
      'Bhutan':[27.47,89.64],'Bolivia':[-16.5,-68.15],'Bosnia and Herzegovina':[43.86,18.41],
      'Botswana':[-24.63,25.9],'Brazil':[-15.78,-47.93],'Brunei':[4.93,114.97],
      'Bulgaria':[42.7,23.32],'Burkina Faso':[12.37,-1.52],'Burundi':[-3.38,29.36],
      'Cambodia':[11.56,104.92],'Cameroon':[3.87,11.52],'Canada':[45.42,-75.7],
      'Central African Republic':[4.39,18.56],'Chad':[12.13,15.05],'Chile':[-33.45,-70.67],
      'China':[39.92,116.38],'Colombia':[4.71,-74.07],'Congo':[-4.32,15.31],
      'Costa Rica':[9.93,-84.08],"Côte d'Ivoire":[5.33,-4.01],'Croatia':[45.81,15.98],
      'Cuba':[23.11,-82.37],'Cyprus':[35.17,33.37],'Czechia':[50.09,14.44],
      'Dem. Rep. Congo':[-4.32,15.31],'Denmark':[55.68,12.57],'Djibouti':[11.59,43.15],
      'Dominican Republic':[18.47,-69.9],'Ecuador':[-0.18,-78.47],'Egypt':[30.05,31.23],
      'El Salvador':[13.69,-89.19],'Equatorial Guinea':[3.75,8.78],'Eritrea':[15.34,38.93],
      'Estonia':[59.44,24.75],'Ethiopia':[9.03,38.75],'Fiji':[-18.14,178.44],
      'Finland':[60.17,24.94],'France':[48.86,2.35],'Gabon':[0.38,9.45],
      'Gambia':[13.44,-16.57],'Georgia':[41.69,44.8],'Germany':[52.52,13.41],
      'Ghana':[5.6,-0.19],'Greece':[37.98,23.73],'Greenland':[72.18,-42.6],
      'Guatemala':[14.63,-90.51],'Guinea':[9.65,-13.58],'Guinea-Bissau':[11.8,-15.59],
      'Guyana':[6.8,-58.15],'Haiti':[18.54,-72.34],'Honduras':[14.08,-87.22],
      'Hungary':[47.5,19.04],'Iceland':[64.15,-21.94],'India':[28.61,77.21],
      'Indonesia':[-6.21,106.85],'Iran':[35.69,51.39],'Iraq':[33.31,44.37],
      'Ireland':[53.35,-6.26],'Israel':[31.77,35.23],'Italy':[41.9,12.5],
      'Jamaica':[18.0,-76.79],'Japan':[35.68,139.69],'Jordan':[31.95,35.93],
      'Kazakhstan':[51.13,71.43],'Kenya':[-1.29,36.82],'Kosovo':[42.67,21.17],
      'Kuwait':[29.38,47.99],'Kyrgyzstan':[42.87,74.59],'Laos':[17.97,102.63],
      'Latvia':[56.95,24.11],'Lebanon':[33.89,35.5],"Lesotho":[-29.32,27.49],
      'Liberia':[6.3,-10.8],'Libya':[32.9,13.18],'Lithuania':[54.69,25.28],
      'Luxembourg':[49.61,6.13],'Madagascar':[-18.87,47.51],'Malawi':[-13.96,33.79],
      'Malaysia':[3.14,101.69],'Mali':[12.64,-8],'Mauritania':[18.09,-15.98],
      'Mexico':[19.43,-99.13],'Moldova':[47.01,28.86],'Mongolia':[47.91,106.91],
      'Montenegro':[42.44,19.26],'Morocco':[34.02,-6.84],'Mozambique':[-25.97,32.57],
      'Myanmar':[19.76,96.08],'Namibia':[-22.57,17.08],'Nepal':[27.72,85.32],
      'Netherlands':[52.37,4.9],'New Zealand':[-41.29,174.78],'Nicaragua':[12.11,-86.24],
      'Niger':[13.51,2.11],'Nigeria':[9.06,7.49],'North Korea':[39.02,125.75],
      'North Macedonia':[42,21.43],'Norway':[59.91,10.75],'Oman':[23.59,58.54],
      'Pakistan':[33.69,73.04],'Panama':[8.98,-79.52],'Papua New Guinea':[-6.31,143.96],
      'Paraguay':[-25.26,-57.58],'Peru':[-12.05,-77.04],'Philippines':[14.6,120.98],
      'Poland':[52.23,21.01],'Portugal':[38.72,-9.14],'Qatar':[25.35,51.18],
      'Romania':[44.43,26.1],'Russia':[55.76,37.62],'Rwanda':[-1.94,30.06],
      'Saudi Arabia':[24.69,46.72],'Senegal':[14.72,-17.47],'Serbia':[44.79,20.47],
      'Sierra Leone':[8.46,-13.23],'Slovakia':[48.15,17.11],'Slovenia':[46.06,14.51],
      'Singapore':[1.29,103.85],
      'Somalia':[2.05,45.32],'South Africa':[-29.0,24.0],'South Korea':[37.57,126.98],
      'South Sudan':[4.85,31.58],'Spain':[40.42,-3.7],'Sri Lanka':[6.93,79.85],
      'Sudan':[15.5,32.56],'Suriname':[5.85,-55.2],'Sweden':[59.33,18.07],
      'Switzerland':[46.95,7.45],'Syria':[33.51,36.29],'Tajikistan':[38.56,68.77],
      'Tanzania':[-6.79,39.28],'Thailand':[13.76,100.5],'Timor-Leste':[-8.56,125.57],
      'Togo':[6.13,1.23],'Tunisia':[36.81,10.18],'Turkey':[39.93,32.86],
      'Turkmenistan':[37.95,58.38],'Uganda':[0.35,32.58],'Ukraine':[50.45,30.52],
      'United Arab Emirates':[24.47,54.37],'United Kingdom':[51.51,-0.13],
      'United States':[38.9,-77.04],'Uruguay':[-34.88,-56.18],'Uzbekistan':[41.3,69.28],
      'Venezuela':[10.48,-66.9],'Vietnam':[21.03,105.85],'Yemen':[15.37,44.19],
      'Zambia':[-15.39,28.32],'Zimbabwe':[-17.83,31.05],
      'W. Sahara':[24.22,-12.88],'Somaliland':[10.59,49.8],'N. Cyprus':[35.18,33.38],
      'Palestine':[31.9,35.2],'Puerto Rico':[18.47,-66.1],
    };

    const starCanvas = document.createElement('canvas');
    starCanvas.width = 64; starCanvas.height = 64;
    const sctx = starCanvas.getContext('2d');
    sctx.fillStyle = '#000000';
    sctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outerAngle = (i * 72 - 90) * Math.PI / 180;
      const innerAngle = ((i * 72) + 36 - 90) * Math.PI / 180;
      const outerR = 20, innerR = 8;
      if (i === 0) sctx.moveTo(32 + outerR * Math.cos(outerAngle), 32 + outerR * Math.sin(outerAngle));
      else sctx.lineTo(32 + outerR * Math.cos(outerAngle), 32 + outerR * Math.sin(outerAngle));
      sctx.lineTo(32 + innerR * Math.cos(innerAngle), 32 + innerR * Math.sin(innerAngle));
    }
    sctx.closePath(); sctx.fill();
    sctx.strokeStyle = '#333333'; sctx.lineWidth = 1; sctx.stroke();
    const starTex = new THREE.CanvasTexture(starCanvas);

    const starGroup = new THREE.Group();
    starGroup.name = 'capitalStars';
    const STAR_R = 1.012;
    const STAR_SIZE = 0.016;
    countries.features.forEach(feature => {
      const name = feature.properties.NAME || '';
      const coords = capitalCoords[name];
      if (!coords) return;
      const [lat, lon] = coords;
      const starGeo = new THREE.PlaneGeometry(STAR_SIZE, STAR_SIZE, 2, 2);
      const sPos = starGeo.attributes.position;
      for (let i = 0; i < sPos.count; i++) {
        const x = sPos.getX(i), y = sPos.getY(i);
        const d = Math.sqrt(x*x + y*y + STAR_R*STAR_R);
        sPos.setXYZ(i, x * STAR_R / d, y * STAR_R / d, STAR_R * STAR_R / d - STAR_R);
      }
      starGeo.computeVertexNormals();
      const starMat = new THREE.MeshBasicMaterial({ map: starTex, transparent: true, side: THREE.DoubleSide, depthTest: true, depthWrite: false });
      const starMesh = new THREE.Mesh(starGeo, starMat);
      const pos = latLonToVec3(lat, lon, STAR_R);
      starMesh.position.copy(pos);
      const normal = pos.clone().normalize();
      const worldUp = new THREE.Vector3(0, 1, 0);
      const east = new THREE.Vector3().crossVectors(worldUp, normal).normalize();
      const north = new THREE.Vector3().crossVectors(normal, east).normalize();
      starMesh.setRotationFromMatrix(new THREE.Matrix4().makeBasis(east, north, normal));
      starGroup.add(starMesh);
    });
    earthGroup.add(starGroup);
    window.__capitalStars = starGroup;

    window.__latLonToVec3 = latLonToVec3;
  })
  .catch(err => { console.warn('边界数据加载失败:', err); });
}
createBorderOverlay();
