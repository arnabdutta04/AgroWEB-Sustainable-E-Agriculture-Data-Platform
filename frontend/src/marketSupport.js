// src/marketSupport.js
// Auto-generated from district_encoder.pkl audit.
// 509 frontend districts have no market encoder entry.
// Do NOT send these to /predict/market — the model will crash or return garbage.

export const UNSUPPORTED_MARKET_DISTRICTS = new Set([
  "Adilabad","Ahmedabad","Ahmednagar","Aizawl","Akola","Almora","Ambala",
  "Ambedkar Nagar","Amravati","Anakapalli","Angul","Anjaw","Annamayya",
  "Anupgarh","Anuppur","Araria","Aravalli","Ariyalur","Arwal","Aurangabad",
  "Ayodhya","Bagalkot","Bageshwar","Baksa","Balangir","Balasore","Ballari",
  "Balod","Baloda Bazar","Banaskantha","Banka","Banswara","Bargarh","Barpeta",
  "Barwani","Bastar","Bathinda","Beed","Begusarai","Belagavi","Bemetara",
  "Bengaluru Rural","Bengaluru Urban","Bhadohi","Bhadradri Kothagudem",
  "Bhadrak","Bhagalpur","Bhandara","Bhiwani","Bhojpur","Bidar","Bijapur",
  "Bilaspur","Bishnupur","Biswanath","Bokaro","Bongaigaon","Boudh","Budaun",
  "Bulandshahr","Buldhana","Buxar","Cachar","Chamarajanagar","Chamba",
  "Chamoli","Champawat","Champhai","Chandel","Chandrapur","Changlang",
  "Charaideo","Charkhi Dadri","Chatra","Chengalpattu","Chennai",
  "Chhota Udaipur","Chikballapur","Chikkamagaluru","Chirang","Chitradurga",
  "Chitrakoot","Chittoor","Churachandpur","Chümoukedima","Coimbatore",
  "Cuddalore","Cuttack","Dakshin Dinajpur","Dakshina Kannada","Dantewada",
  "Darbhanga","Darrang","Davanagere","Dehradun","Deogarh","Deoghar","Dhalai",
  "Dhamtari","Dhanbad","Dharmapuri","Dharwad","Dhemaji","Dhenkanal","Dhubri",
  "Dhule","Dibang Valley","Dibrugarh","Dima Hasao","Dimapur","Dindigul",
  "Dumka","Durg","East Champaran","East Garo Hills","East Jaintia Hills",
  "East Kameng","East Khasi Hills","East Siang","East Singhbhum",
  "Eastern West Khasi Hills","Erode","Faridabad","Farrukhabad","Fatehabad",
  "Fatehgarh Sahib","Ferozepur","Gadag","Gadchiroli","Gajapati",
  "Gangapur City","Gangtok","Ganjam","Garhwa","Gariaband",
  "Gaurela-Pendra-Marwahi","Gautam Buddha Nagar","Gaya","Giridih","Goalpara",
  "Godda","Golaghat","Gomati","Gondia","Gopalganj","Gumla","Gurugram",
  "Gyalshing","Hailakandi","Hanamkonda","Hapur","Haridwar","Hassan","Haveri",
  "Hazaribagh","Hingoli","Hisar","Hnahthial","Hojai","Hyderabad",
  "Imphal East","Imphal West","Jagatsinghpur","Jagtial","Jajpur","Jalaun",
  "Jalgaon","Jalna","Jamtara","Jamui","Jangaon","Janjgir-Champa","Jashpur",
  "Jayashankar Bhupalpally","Jehanabad","Jhajjar","Jharsuguda","Jind",
  "Jiribam","Jogulamba Gadwal","Jorhat","Junagadh","Kabirdham","Kaimur",
  "Kaithal","Kakching","Kalaburagi","Kalahandi","Kallakurichi","Kamareddy",
  "Kamjong","Kamle","Kamrup","Kamrup Metropolitan","Kanchipuram","Kandhamal",
  "Kangpokpi","Kangra","Kanker","Kannauj","Kanpur Nagar","Kanyakumari",
  "Karbi Anglong","Karimganj","Karimnagar","Karnal","Karur","Kasaragod",
  "Katihar","Kendrapara","Kendujhar","Khagaria","Khairagarh-Chhuikhadan-Gandai",
  "Khammam","Khawzawl","Kheri","Khordha","Khowai","Khunti","Kinnaur",
  "Kiphire","Kishanganj","Kodagu","Koderma","Kohima","Kokrajhar","Kolar",
  "Kolasib","Kolhapur","Komaram Bheem Asifabad","Kondagaon","Koppal",
  "Koraput","Korba","Koriya","Kozhikode","Kra Daadi","Krishnagiri","Kullu",
  "Kurukshetra","Kurung Kumey","Kushinagar","Lahaul and Spiti","Lakhisarai",
  "Latehar","Latur","Lawngtlai","Leparada","Lohardaga","Lohit","Longding",
  "Longleng","Lower Dibang Valley","Lower Siang","Lower Subansiri","Lunglei",
  "Madhepura","Madhubani","Madurai","Mahabubabad","Mahabubnagar","Mahasamund",
  "Mahendragarh","Mahisagar","Majuli","Malda","Malkangiri","Mamit",
  "Mancherial","Mandi","Mandya","Manendragarh-Chirmiri-Bharatpur","Mangan",
  "Mau","Mayiladuthurai","Mayurbhanj","Medak","Medchal-Malkajgiri","Mehsana",
  "Mohali","Mohla-Manpur-Ambagarh Chowki","Mokokchung","Mon","Moradabad",
  "Morigaon","Mulugu","Mumbai City","Mumbai Suburban","Mungeli","Munger",
  "Muzaffarpur","Mysuru","Nabarangpur","Nagaon","Nagapattinam","Nagarkurnool",
  "Nagpur","Nainital","Nalanda","Nalbari","Nalgonda","Namakkal","Namchi",
  "Namsai","Nanded","Nandurbar","Narayanpet","Narayanpur","Nashik","Nawada",
  "Nayagarh","Nilgiris","Nirmal","Niuland","Niwari","Nizamabad","Noklak",
  "Noney","North 24 Parganas","North Garo Hills","North Goa","North Tripura",
  "Nuapada","Nuh","Osmanabad","Pakke-Kessang","Pakur","Pakyong","Palakkad",
  "Palamu","Palghar","Palwal","Panchkula","Panchmahal","Panipat","Papum Pare",
  "Parbhani","Parvathipuram Manyam","Paschim Medinipur","Patna","Pauri Garhwal",
  "Peddapalli","Perambalur","Peren","Phek","Pherzawl","Pilibhit","Pithoragarh",
  "Prakasam","Prayagraj","Pudukkottai","Pune","Purba Medinipur","Puri",
  "Purnia","Purulia","Raebareli","Raichur","Raigad","Raigarh","Raipur",
  "Rajanna Sircilla","Rajnandgaon","Ramanagara","Ramanathapuram","Ramgarh",
  "Ranchi","Rangareddy","Ranipet","Ratnagiri","Rayagada","Rewari","Ri-Bhoi",
  "Rohtak","Rohtas","Rudraprayag","Rupnagar","Sabarkantha","Saharsa",
  "Sahibganj","Saiha","Saitual","Sakti","Salem","Samastipur","Sambalpur",
  "Sanchore","Sangareddy","Sangli","Sant Kabir Nagar","Saraikela-Kharsawan",
  "Saran","Sarangarh-Bilaigarh","Satara","Sawai Madhopur","Senapati",
  "Sepahijala","Serchhip","Shahdol","Shaheed Bhagat Singh Nagar","Shamator",
  "Sheikhpura","Sheohar","Shi Yomi","Shimla","Shivamogga","Siang","Siddipet",
  "Simdega","Sindhudurg","Singrauli","Sirmaur","Sirsa","Sitamarhi","Sivaganga",
  "Sivasagar","Siwan","Solan","Solapur","Sonipat","Sonitpur","Soreng",
  "South 24 Parganas","South Garo Hills","South Goa","South Salmara-Mankachar",
  "South Tripura","South West Garo Hills","South West Khasi Hills",
  "Sri Ganganagar","Srikakulam","Subarnapur","Sukma","Sultanpur","Sundargarh",
  "Supaul","Surajpur","Surguja","Suryapet","Tamenglong","Tapi","Tarn Taran",
  "Tawang","Tehri Garhwal","Tengnoupal","Tenkasi","Thane","Thanjavur","Theni",
  "Thoothukudi","Thoubal","Thrissur","Tinsukia","Tirap","Tiruchirappalli",
  "Tirunelveli","Tirupathur","Tirupati","Tiruppur","Tiruvallur","Tiruvannamalai",
  "Tiruvarur","Tseminyü","Tuensang","Tumakuru","Udalguri","Udham Singh Nagar",
  "Udupi","Ukhrul","Umaria","Una","Unakoti","Upper Siang","Upper Subansiri",
  "Uttar Dinajpur","Uttara Kannada","Uttarkashi","Vadodara","Vaishali","Vellore",
  "Vijayanagara","Vijayapura","Vikarabad","Viluppuram","Virudhunagar",
  "Visakhapatnam","Vizianagaram","Wanaparthy","Warangal","Wardha","Washim",
  "West Champaran","West Garo Hills","West Jaintia Hills","West Kameng",
  "West Karbi Anglong","West Khasi Hills","West Siang","West Singhbhum",
  "West Tripura","Wokha","YSR Kadapa","Yadadri Bhuvanagiri","Yadgir",
  "Yamunanagar","Yavatmal","Zunheboto",
]);

/**
 * Returns true if the district can be sent to /predict/market.
 * @param {string} districtName - exact name as stored in selectedDistrict
 */
/**
 * All districts are now supported via nearest-neighbour fallback in the backend.
 * This function always returns true so the submit button is never blocked.
 * The backend returns is_fallback=true for districts not in district_encoder.pkl.
 */
export function isMarketSupported(districtName) {
  return !!districtName;  // true for any non-empty string
}

/**
 * Returns true if the district was originally in district_encoder.pkl (no fallback needed).
 * Can be used to show UI hints, but prediction always proceeds.
 */
export function isMarketDirectlySupported(districtName) {
  if (!districtName) return false;
  return !UNSUPPORTED_MARKET_DISTRICTS.has(districtName.trim());
}