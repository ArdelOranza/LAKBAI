// Curated Pangasinan festivals — user-supplied dataset (30 entries) with the
// official source URL kept per festival. Month/day are the usual window;
// organisers shift dates year to year, so `vague: true` marks entries where the
// source only gives a month or "2nd week" (the row shows the month only).
// Photos are stored data-only for now: every tile still renders the neutral
// placeholder until the photo pass lands. lng/lat are town centroids from
// spots-coords.json; towns without a geocoded spot simply omit them.
export const FESTIVALS = [
  {
    id: 'patupat-festival', name: 'Patupat Festival', town: 'Pozorrubio', district: 'District 5',
    month: 1, day: 9, endMonth: 1, endDay: 18, vague: true,
    dateLabel: 'January (2nd week of January, around January 9–18 during the Town Fiesta)',
    blurb: "Launched in 2012 in Pozorrubio (established January 13, 1870, formerly Claris after hero Juan dela Cruz Palaris), the festival honours the town's native delicacy: glutinous rice boiled in sugarcane juice and wrapped in woven coconut leaves.",
    whatToDo: [
      'Taste freshly boiled patupat cooked in giant vats of simmering sugarcane juice at the Pozorrubio Town Plaza.',
      'Watch street dancers in costumes crafted from woven coconut fronds.',
      "Visit Barangay Palac-palac (Neneng's Cutlery) for world-renowned hand-forged blades.",
    ],
    photos: ['https://imgv2-1-f.scribdassets.com/img/document/127131661/298x396/8b2e9a8642/1724018204?v=1'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/pozorrubio/',
    lng: 120.545, lat: 16.111,
  },
  {
    id: 'carabao-festival-bugallon', name: 'Carabao Festival (Bugallon Day)', town: 'Bugallon', district: 'District 2',
    month: 1, day: 12, endMonth: 1, endDay: 12,
    dateLabel: 'January 12 (Bugallon Founding Anniversary and Town Fiesta)',
    blurb: 'Originally Salasa and renamed in 1921 after Major Jose Torres Bugallon, this farming town honours the carabao — the partner of local farmers working its rice, corn and sugarcane fields.',
    whatToDo: [
      'Watch the parade of decorated carabaos and agricultural floats through the Bugallon Town Plaza.',
      'Join the traditional farming games, street dancing and trade fairs.',
      'Take a side trip to the Mt. Zion Pilgrim Site for trekking and ATV trails.',
    ],
    photos: ['https://imgv2-2-f.scribdassets.com/img/document/456844997/original/263f895208/1?v=1'],
    source: 'https://www.pangasinan.gov.ph/district/2nd-district/',
  },
  {
    id: 'talong-festival', name: 'Talong Festival', town: 'Villasis', district: 'District 5',
    month: 1, day: 11, endMonth: 1, endDay: 21, vague: true,
    dateLabel: 'January (2nd to 3rd week, around January 11–21, with the Feast of St. Anthony Abbot)',
    blurb: 'Launched in its 9-day format in 2012 with the Villasis Vegetable Trading Post, the Talong Festival celebrates the town as the Vegetable Basket of the North and its top eggplant harvest.',
    whatToDo: [
      "Join the 'Kalutan tan Gayaga ed Dalan' street grilling of thousands of eggplants along the highway.",
      'Sample eggplant flan, lasagna and pinakbet in the culinary competitions.',
      'Watch the Talong street dancing and visit the Villasis Bagsakan market.',
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/06/villasis-seal.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/villasis/',
    lng: 120.62, lat: 15.937,
  },
  {
    id: 'bagoong-festival', name: 'Bagoong Festival', town: 'Lingayen', district: 'District 2',
    month: 1, day: 17, endMonth: 1, endDay: 27, vague: true,
    dateLabel: 'January (traditionally 3rd week, Jan 17–27; also staged March 18–20 in 2026)',
    blurb: "Celebrated since 2011 in the provincial capital, the festival exalts Lingayen's One Town, One Product: fish and shrimp paste cured for months in traditional burnay jars.",
    whatToDo: [
      'Watch street dances reenacting the salt-fermenting and bagoong-making process.',
      'Join community boodle fights with green mangoes, pinakbet, kare-kare and bagoong recipes.',
      'Shop bottled bagoong, bagoong alamang and patis from local processors, then walk the baywalk.',
    ],
    photos: [
      'https://www.lingayen.gov.ph/wp-content/themes/yootheme/cache/99/638322600_122153787338920789_3681875236775289188_n-1-991e2d2c.jpeg',
      'https://www.lingayen.gov.ph/wp-content/themes/yootheme/cache/44/638322600_122153787338920789_3681875236775289188_n-446d2c8c.jpeg',
    ],
    source: 'https://www.lingayen.gov.ph/tourism/festivities/',
    lng: 120.28533, lat: 16.09233,
  },
  {
    id: 'sigay-festival', name: 'Sigay Festival', town: 'Binmaley', district: 'District 2',
    month: 1, day: 25, endMonth: 2, endDay: 3,
    dateLabel: 'January 25 – February 3 (with the Feast of Our Lady of Purification)',
    blurb: "From the Pangasinan word 'sigay' — to harvest or gather the catch — the festival highlights Binmaley's brackish-water aquaculture: milkfish, prawns and Malaga fish.",
    whatToDo: [
      "Feast at the 'Kalutan ed Dalan' roadside seafood grilling and join the river fluvial parade.",
      'Visit the 396-year-old Our Lady of Purification Parish Church for the town fiesta.',
      'Browse handcrafted wooden furniture along the Lingayen–Binmaley Road.',
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/07/PangasinanBanner_Capitol2.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/binmaley/',
    lng: 120.27, lat: 16.045,
  },
  {
    id: 'pakwan-festival', name: 'Pakwan Festival (Watermelon)', town: 'Bani', district: 'District 1',
    month: 2, day: 1, endMonth: 2, endDay: 28, vague: true,
    dateLabel: 'February (early February)',
    blurb: "Founded in 1769 and annexed to Pangasinan in 1903, Bani launched the Pakwan Festival to promote its status as the Watermelon Capital of the North.",
    whatToDo: [
      'Join the free watermelon slices, eating contests and carving competitions.',
      'Watch the street dancing and float parade dressed in fresh produce.',
      "Explore Bani's Surip Beach, Olanen Beach and local caves.",
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/07/PangasinanBanner_Capitol2.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/bani/',
    lng: 119.8955, lat: 16.2155,
  },
  {
    id: 'asin-festival', name: 'Asin Festival', town: 'Dasol', district: 'District 1',
    month: 2, day: 1, endMonth: 3, endDay: 31, vague: true,
    dateLabel: 'First Saturday of Lent (late February or March, with the feast of St. Vincent Ferrer)',
    blurb: "In the coastal town of Dasol, the Asin Festival pays tribute to the salt-makers ('asinderos') and the solar salt beds along Dasol Bay — the root of the name Pangasinan.",
    whatToDo: [
      "Tour Dasol's solar salt farms and watch seawater raked into white sea salt crystals.",
      'Attend the religious feast and procession for patron St. Vincent Ferrer.',
      'Relax at Tambobong White Sand Beach and Colibra (Snake) Island.',
    ],
    photos: ['https://imgv2-2-f.scribdassets.com/img/document/853354510/original/39be65bc48/1?v=1'],
    source: 'https://www.festivalscape.com/philippines/pangasinan/asin-festival/',
    lng: 119.831, lat: 15.9605,
  },
  {
    id: 'pindang-festival', name: 'Pindang Festival', town: 'Mangaldan', district: 'District 4',
    month: 3, day: 1, endMonth: 3, endDay: 10,
    dateLabel: 'March 1 – March 10 (Mangaldan Town Fiesta)',
    blurb: "Launched in 2012 in one of Pangasinan's oldest towns, the Pindang Festival honours local butchers and the town's signature cured carabao meat.",
    whatToDo: [
      "Join the 'Bengbengan, Kalutan tan Togtogan ed Dalan' street party with carabeef pindang and longganisa.",
      'Watch the cultural street dances and pageants at the town plaza.',
      'Buy Romana Peanut Brittle, peanut adobo and ube halaya for pasalubong.',
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/06/mangaldan-seal.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/mangaldan/',
    lng: 120.404, lat: 16.07,
  },
  {
    id: 'hundred-islands-festival', name: 'Hundred Islands Festival (Paraw)', town: 'Alaminos City', district: 'District 1',
    month: 3, day: 18, endMonth: 3, endDay: 19,
    dateLabel: 'March 18 – March 19 (feast of St. Joseph; cityhood on March 28)',
    blurb: "Celebrates Alaminos City's Hundred Islands National Park and the feast of its patron, St. Joseph — maritime heritage, coastal biodiversity and local delicacies.",
    whatToDo: [
      'Watch the Paraw Parade of traditional outrigger sailboats across Lucap Bay.',
      "Feast at the 'Talaba Ihaw-Ihaw' oyster grill and the Alaminos Longganisa Grill Fest.",
      'Go island hopping, snorkelling and ziplining in the national park, then attend mass at St. Joseph Cathedral.',
    ],
    photos: ['https://www.alaminoscity.gov.ph/_photos/festivals/HolyWeekCelebration-AlaminosCity-Mass1.jpg'],
    source: 'https://www.alaminoscity.gov.ph/discover-alaminos/festivals.html',
    lng: 119.97467, lat: 16.158,
  },
  {
    id: 'dumayo-festival', name: 'Dumayo Festival', town: 'Urdaneta City', district: 'District 5',
    month: 3, day: 21, endMonth: 3, endDay: 21,
    dateLabel: 'March (around March 21, Urdaneta City Charter Day)',
    blurb: "From 'dumayo' — to visit or flock to — the festival recognises the early Ilocano settlers who formed Urdaneta and its role as the trading and livestock hub of eastern Pangasinan.",
    whatToDo: [
      "Watch grand street dancing and cultural shows for the city's charter anniversary.",
      'Visit the livestock market, trade fairs and Museo de Urdaneta.',
      'Explore the Cabaruan, Sugcong and Oltama rolling hills nearby.',
    ],
    photos: ['https://imgv2-1-f.scribdassets.com/img/document/127131661/298x396/8b2e9a8642/1724018204?v=1'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/urdaneta-city/',
    lng: 120.57133, lat: 15.96833,
  },
  {
    id: 'agew-na-pangasinan', name: 'Agew na Pangasinan', town: 'Lingayen', district: 'Province-wide',
    month: 4, day: 5, endMonth: 4, endDay: 5,
    dateLabel: 'April 5',
    blurb: "Commemorates the founding of the Province of Pangasinan on April 5, 1580, and opens the month-long Pista'y Dayat festivities.",
    whatToDo: [
      'Attend the commemorative program and parade at the Provincial Capitol Complex.',
      'Visit the Pangasinan Tourism and Trade Expo for MSMEs and OTOP booths.',
      'See Casa Real, Urduja House and the Banaan Pangasinan Provincial Museum.',
    ],
    photos: [
      'https://seepangasinan.com/wp-content/uploads/2022/04/EXPO-3-1024x768.jpg',
      'https://seepangasinan.com/wp-content/uploads/2021/07/169541027_5966519370040744_8344380713880156513_n.jpeg',
    ],
    source: 'https://seepangasinan.com/pangasinan-celebrates-442nd-agew-na-pangasinan-and-13th-pangasinan-tourism-and-trade-expo/',
    lng: 120.28533, lat: 16.09233,
  },
  {
    id: 'bangus-festival', name: 'Bangus Festival', town: 'Dagupan City', district: 'District 4',
    month: 4, day: 1, endMonth: 4, endDay: 30,
    dateLabel: 'April 1 – April 30 (culminates April 30)',
    blurb: "Launched in 2002, the Bangus Festival celebrates Dagupan as the Bangus Capital of the Philippines, its milkfish prized for the brackish estuaries and natural lablab algae beds.",
    whatToDo: [
      'Join Kalutan ed Dalan on April 30, when thousands of milkfish are grilled along downtown streets.',
      'Watch Gilon-Gilon ed Baley street dancing about milkfish farming life.',
      'Try the Bangus Rodeo — fastest deboning, eating contests and weigh-ins.',
      'Sample boneless bangus, bangus sisig, relyenong bangus and pigar-pigar.',
    ],
    photos: [
      'https://www.dagupan.gov.ph/wp-content/uploads/2023/05/341630377_762883958541447_3895670155149851497_n-710x415.jpg',
      'https://www.dagupan.gov.ph/wp-content/uploads/2026/05/689025069_122168011268686163_6980868486337591865_n.jpg',
    ],
    source: 'https://www.dagupan.gov.ph/category/bangus-festival/',
    lng: 120.33633, lat: 16.03667,
  },
  {
    id: 'malangsi-fishtival', name: 'Malangsi Fishtival', town: 'Bayambang', district: 'District 3',
    month: 4, day: 1, endMonth: 4, endDay: 7, vague: true,
    dateLabel: 'April (1st week, with the Town Fiesta and Founding Anniversary)',
    blurb: "In Bayambang — briefly the 5th capital of the First Philippine Republic in 1899 — the Malangsi Fishtival celebrates freshwater fish from the Agno River and Mangabul Lake.",
    whatToDo: [
      "Join the 'Kalutan tan Gayaga ed Dalan' street barbecue and concert.",
      'Watch the street dancing and fluvial fishing contests.',
      'Visit the 50.23-meter St. Vincent Ferrer bamboo statue, the tallest of its kind.',
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/07/PangasinanBanner_Capitol6.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/bayambang/',
  },
  {
    id: 'mangunguna-festival', name: 'Mangunguna Festival', town: 'Bolinao', district: 'District 1',
    month: 4, day: 9, endMonth: 4, endDay: 14,
    dateLabel: 'April (2nd week, around April 9–14)',
    blurb: "From 'mangunguna' — fisherman — the festival honours Bolinao's fisherfolk and the marine biodiversity of its waters, home to giant clams and monamon anchovy.",
    whatToDo: [
      'Watch maritime competitions, boat races, seafood cook-offs and street dancing.',
      'Unwind at Patar White Sand Beach, Enchanted Cave and Cape Bolinao Lighthouse.',
      'Cruise the Balingasay River and taste authentic Bolinao binungey.',
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/07/PangasinanBanner_Capitol2.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/bolinao/',
    lng: 119.86907, lat: 16.30293,
  },
  {
    id: 'pandan-festival', name: 'Pandan Festival', town: 'Mapandan', district: 'District 3',
    month: 4, day: 8, endMonth: 4, endDay: 14, vague: true,
    dateLabel: 'April (2nd week)',
    blurb: 'Mapandan took its name from the fragrant pandan plant that grew abundantly here; the festival is a thanksgiving for the town’s agricultural bounties.',
    whatToDo: [
      'Watch street dancers in pandan-inspired costumes and choreography.',
      'Visit the agro-industrial trade fair at the Municipal Plaza.',
      'Sample pandan-flavoured native delicacies and local farm produce.',
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/07/PangasinanBanner_Capitol6.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/mapandan/',
    lng: 120.453, lat: 16.027,
  },
  {
    id: 'binungey-festival', name: 'Binungey Festival', town: 'Anda', district: 'District 1',
    month: 4, day: 15, endMonth: 4, endDay: 20, vague: true,
    dateLabel: 'April (mid-April)',
    blurb: "On the island municipality of Anda — the Mother of the Hundred Islands — the Binungey Festival promotes its signature sweet sticky rice roasted inside bamboo tubes.",
    whatToDo: [
      'Watch live bamboo-roasting demos and taste freshly split, smoky binungey.',
      "Catch the street dance competition featured in Pangasinan's Gayaga showcase.",
      'Swim at Tondol White Sand Beach and explore Cabagnow Cave Pool.',
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/07/PangasinanBanner_Capitol2.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/anda/',
    lng: 119.91, lat: 16.3355,
  },
  {
    id: 'mango-bamboo-festival', name: 'Mango-Bamboo Festival', town: 'San Carlos City', district: 'District 3',
    month: 4, day: 15, endMonth: 4, endDay: 27, vague: true,
    dateLabel: 'April (3rd to last week, e.g. April 15–27)',
    blurb: 'Launched in 2001 in the old capital of Caboloan, this week-long festival celebrates the city’s twin products: carabao mangoes and bamboo crafts.',
    whatToDo: [
      'Watch street dancing and float parades in bamboo-woven, mango-themed costumes.',
      'Shop carabao mangoes, bamboo furniture and woven handicrafts at the trade fair.',
      'Join mango-eating contests and the giant mango pie showcase.',
    ],
    photos: [
      'https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=375,fit=crop/Y4LOrgPqO0srNeM2/437374955_753532906964957_4788859984165549349_n-A1aKLeDlO0T4GZvP.jpg',
      'https://www.hlimg.com/images/events/738X538/event_1538550248m1.jpg',
    ],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/san-carlos-city/',
    lng: 120.34867, lat: 15.924,
  },
  {
    id: 'umbrella-rocks-festival', name: 'Umbrella Rocks Festival', town: 'Agno', district: 'District 1',
    month: 4, day: 1, endMonth: 5, endDay: 31, vague: true,
    dateLabel: 'April / May (summer season)',
    blurb: 'The coastal town of Agno celebrates its famous mushroom- and umbrella-shaped limestone formations sculpted by waves along Sabangan Beach.',
    whatToDo: [
      'Visit the Umbrella Rocks of Sabangan along the West Philippine Sea coast.',
      'Enjoy beachside cultural performances, summer sports and the mango and duhat harvest.',
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/07/PangasinanBanner_Capitol2.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/agno/',
    lng: 119.765, lat: 16.169,
  },
  {
    id: 'pistay-dayat', name: "Pista'y Dayat", town: 'Lingayen', district: 'Province-wide',
    month: 4, day: 5, endMonth: 5, endDay: 1,
    dateLabel: 'April 5 – May 1 (grand culmination May 1)',
    blurb: "Started in 1970, Pista'y Dayat — fiesta of the sea — is the Mother of All Festivals in Pangasinan: a province-wide thanksgiving for the harvest of sea and fields.",
    whatToDo: [
      'Watch the Banca Parada, a fluvial parade of decorated fishing boats.',
      'See the Gayaga street dance exhibition of contingents from across the province.',
      'Attend Limgas na Pangasinan and the sand sculpture competition on Lingayen Beach.',
      'Shop the Tourism and Trade Expo and join the baybay concert and coastal clean-up.',
    ],
    photos: ['https://seepangasinan.com/wp-content/uploads/2026/03/1.png'],
    source: 'https://www.festivalscape.com/philippines/pangasinan/pistay-dayat/',
    lng: 120.28533, lat: 16.09233,
  },
  {
    id: 'balincaguin-festival', name: 'Balincaguin Festival', town: 'Mabini', district: 'District 1',
    month: 5, day: 1, endMonth: 5, endDay: 31, vague: true,
    dateLabel: 'January / May (town fiesta and Pista’y Dayat Gayaga showcase)',
    blurb: "Originally Balincaguin — 'abode of bats' — Mabini's festival depicts the town's cave ecology and Sambal-Pangasinense heritage.",
    whatToDo: [
      "Watch street dances of the 'Bali Lan Caguin' legend and basket-weaving traditions.",
      'Spelunk the 4-kilometer Cacupangan Cave System and swim in the Balincaguin River.',
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/07/PangasinanBanner_Capitol2.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/mabini/',
  },
  {
    id: 'sawali-festival', name: 'Sawali Festival', town: 'Labrador', district: 'District 2',
    month: 5, day: 15, endMonth: 5, endDay: 15,
    dateLabel: 'May (mid-May, feast of St. Isidro Labrador on May 15)',
    blurb: 'This coastal and mountain town honours its bamboo-weaving (sawali) and broom-making cottage industries.',
    whatToDo: [
      'Watch street dancers in costumes made from woven sawali mats and bamboo.',
      'Buy sawali walls, bamboo crafts and native brooms at the trade fair.',
      'Hike to Tinakayan Falls, climb Mt. San Isidro or relax on the beaches.',
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/06/labrador-seal.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/labrador/',
    lng: 120.146, lat: 16.025,
  },
  {
    id: 'goat-festival', name: 'Goat Festival', town: 'Balungao', district: 'District 6',
    month: 5, day: 1, endMonth: 5, endDay: 31, vague: true,
    dateLabel: 'March / May (Town Fiesta and Founding Anniversary)',
    blurb: "Launched in 2006, the Goat Festival promotes Balungao's goat-raising and chevon culinary industry.",
    whatToDo: [
      'Savour kalderetang kambing, kilawin, papaitan and adobong kambing at the cook-offs.',
      'Watch the dressed-up goat parade and street dancing.',
      'Visit Balungao Hilltop Adventure for mineral springs, ATV rides and a long zipline.',
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/07/PangasinanBanner_Capitol2.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/balungao/',
    lng: 120.679, lat: 15.882,
  },
  {
    id: 'tinapa-festival', name: 'Tinapa Festival', town: 'Rosales', district: 'District 6',
    month: 6, day: 12, endMonth: 6, endDay: 12,
    dateLabel: 'June (with Philippine Independence Day on June 12)',
    blurb: 'Launched in 2015, the Tinapa Festival honours the smoked-fish industry that has sustained families in Carmen West and nearby villages for over 50 years.',
    whatToDo: [
      "Join the giant 'tinapa prepared in kawa' and community boodle fight.",
      'Buy freshly smoked galunggong, bangus and salinas from local smokehouses.',
      'Attend the Independence Day cultural shows, parades and culinary contests.',
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/07/PangasinanBanner_Capitol2.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/rosales/',
  },
  {
    id: 'pangasinan-bamboo-festival', name: 'Pangasinan Bamboo Festival', town: 'Calasiao', district: 'District 3',
    month: 8, day: 12, endMonth: 8, endDay: 14,
    dateLabel: 'August 12 – August 14',
    blurb: 'Organised across Calasiao and Santa Barbara, the festival highlights sustainable bamboo propagation, craftsmanship and eco-industrial livelihood.',
    whatToDo: [
      'Browse exhibitions of bamboo furniture, handicrafts and architectural designs.',
      'Join community bamboo-planting drives and cultural film screenings.',
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/07/PangasinanBanner_Capitol6.png'],
    source: 'https://tpb.gov.ph/calendar-of-philippine-festivals-and-monthly-observances-theme/',
    lng: 120.35033, lat: 16.01567,
  },
  {
    id: 'turak-festival', name: 'Turak Festival (Music Festival)', town: 'Alcala', district: 'District 5',
    month: 9, day: 20, endMonth: 9, endDay: 20,
    dateLabel: 'September (around September 20, town founding anniversary)',
    blurb: 'Established as an independent town by Royal Decree in 1875, Alcala celebrates its founding each September with music and its agricultural heritage.',
    whatToDo: [
      'Catch live bands, musical competitions and street parades for the anniversary.',
      'Visit the 1881 Holy Cross Parish Church and local woodcraft and candle-making shops.',
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/06/alcala-seal.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/alcala/',
  },
  {
    id: 'taraon-festival', name: 'Taraon Festival', town: 'Infanta', district: 'District 1',
    month: 10, day: 4, endMonth: 10, endDay: 4,
    dateLabel: 'May / October (Gayaga showcase; October 4 Foundation Day)',
    blurb: "From 'taraon' — food or sustenance — the festival is a thanksgiving for Infanta's farm, livestock, salt-making and marine harvests.",
    whatToDo: [
      'Watch the Taraon street dance honouring fishermen, salt-makers and rice farmers.',
      "Visit Infanta's coastal salt farms and sample fresh seafood and produce.",
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/07/PangasinanBanner_Capitol2.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/infanta/',
    lng: 120.234, lat: 15.817,
  },
  {
    id: 'ansakket-festival', name: 'Ansakket Festival', town: 'Aguilar', district: 'District 2',
    month: 10, day: 1, endMonth: 10, endDay: 31, vague: true,
    dateLabel: 'October',
    blurb: "Aguilar celebrates 'ansakket' — glutinous rice — the base of Pangasinan's beloved native rice cakes.",
    whatToDo: [
      'Sample suman, deremen, tupig and biko at the town plaza.',
      "Drive or bike the 24-kilometer Daang Katutubo hills — the 'Little Batanes of Pangasinan'.",
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/07/PangasinanBanner_Capitol2.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/aguilar/',
  },
  {
    id: 'galicayo-festival', name: 'Galicayo Festival', town: 'Manaoag', district: 'District 4',
    month: 12, day: 1, endMonth: 12, endDay: 9,
    dateLabel: 'December 1 – December 9 (extends into the 3rd week of December)',
    blurb: "From 'galicayo' — come here — the festival commemorates the apparition of Our Lady of Manaoag, now one of the country's most visited pilgrimage sites.",
    whatToDo: [
      'Attend the novena masses, religious dramas and Marian processions at the Minor Basilica.',
      "Watch street dancing of the apparition and the nighttime Grand Lantern Parade.",
      'Savour tupig and patupat at the Festival of Pangasinan Cuisine.',
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/06/manaoag-seal.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/manaoag/',
    lng: 120.502, lat: 16.03167,
  },
  {
    id: 'kawayan-festival', name: 'Kawayan Festival', town: 'San Nicolas', district: 'District 6',
    month: 12, day: 6, endMonth: 12, endDay: 6,
    dateLabel: 'December (early December, feast of St. Nicholas of Myra on December 6)',
    blurb: 'Launched in 2014, the Kawayan Festival honours the bamboo plantations and artisans of this eastern mountain-border town.',
    whatToDo: [
      'Watch street dancers with intricate bamboo props at the town fiesta.',
      'Shop handcrafted bamboo furniture and woven home decor.',
      'Drive the Villa Verde Trail to Malico and visit Agpay Eco Park.',
    ],
    photos: ['https://www.pangasinan.gov.ph/wp-content/uploads/2023/07/PangasinanBanner_Capitol2.png'],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/san-nicolas/',
    lng: 120.584, lat: 15.911,
  },
  {
    id: 'puto-festival', name: 'Puto Festival', town: 'Calasiao', district: 'District 3',
    month: 12, day: 8, endMonth: 12, endDay: 14, vague: true,
    dateLabel: 'December (mid-December, typically the 2nd week)',
    blurb: "In Calasiao — Pangasinan's second oldest town, founded in 1588 — the Puto Festival honours its 'white gold': bite-sized fermented rice cakes steamed in tiny clay pots.",
    whatToDo: [
      'Marvel at the Puto Mosaic and Puto Construction competitions.',
      'Join the Puto Eating Contest and the Best Way of Cooking Puto showdown.',
      'Buy white, cheese, ube, pandan and salted-egg puto with bocayo, then visit Sts. Peter and Paul Parish.',
    ],
    photos: [
      'https://www.hlimg.com/images/events/738X538/aa_1528868323e.jpg',
      'https://commons.wikimedia.org/wiki/File:Calasiao_Puto_Festival_2024_in_Calasiao,_Pangasinan_4.jpg',
    ],
    source: 'https://www.pangasinan.gov.ph/city-municipalities/calasiao/',
    lng: 120.35033, lat: 16.01567,
  },
];

const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

function edition(year, f){
  const starts = new Date(year, f.month - 1, f.day);
  const ends = new Date(year, (f.endMonth || f.month) - 1, f.endDay || f.day);
  if (ends < starts) ends.setFullYear(ends.getFullYear() + 1); // window crosses New Year
  return { starts, ends };
}

function editionFor(f, from){
  const now = startOfDay(from);
  for (const year of [from.getFullYear(), from.getFullYear() + 1]) {
    const ed = edition(year, f);
    if (endOfDay(ed.ends) >= now) return ed;
  }
  return edition(from.getFullYear() + 2, f);
}

/** Start date of the current or next edition of one festival. */
export function nextOccurrence(f, from = new Date()){
  return editionFor(f, from).starts;
}

/** Festivals with their current/next edition, soonest start first. */
export function upcomingFestivals(list = FESTIVALS, from = new Date()){
  return (list || [])
    .map(f => ({ ...f, ...editionFor(f, from) }))
    .sort((a, b) => a.starts - b.starts);
}

/** Editions whose window overlaps the calendar month of `from`. */
export function thisMonthFestivals(list = FESTIVALS, from = new Date()){
  const monthStart = new Date(from.getFullYear(), from.getMonth(), 1);
  const monthEnd = endOfDay(new Date(from.getFullYear(), from.getMonth() + 1, 0));
  return upcomingFestivals(list, from).filter(f => f.starts <= monthEnd && f.ends >= monthStart);
}