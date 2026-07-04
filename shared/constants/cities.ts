/**
 * India location dataset for autocomplete.
 *
 * Source: All current districts of India + a handful of non-district sub-cities
 * (Navi Mumbai, Greater Noida, etc.). Plus a `CITY_ALIASES` map so common
 * alternative names ("Vizag", "Bombay", "Madras", "Calcutta", "Pondicherry",
 * etc.) resolve to their canonical entries.
 *
 * Why not villages: bundling all ~600,000 Indian villages would add ~50MB to
 * the app. Instead, smaller localities (Bhadra, Bagar, etc.) are reached via
 * the `PinCodeLookup` component which calls India Post's free
 * `api.postalpincode.in` at runtime.
 *
 * Schema unchanged: `city` field on the wire is the formatted string
 * "City, State, Country".
 */

export type CityOption = {
  city: string;
  state: string;
  country: string;
};

// ---------------------------------------------------------------------------
// Non-district extras — planned cities, sub-cities, common but not headquarters
// ---------------------------------------------------------------------------
const EXTRA_CITIES: CityOption[] = [
  { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
  { city: 'Navi Mumbai', state: 'Maharashtra', country: 'India' },
  { city: 'Pimpri-Chinchwad', state: 'Maharashtra', country: 'India' },
  { city: 'Thane', state: 'Maharashtra', country: 'India' },
  { city: 'New Delhi', state: 'Delhi', country: 'India' },
  { city: 'Noida', state: 'Uttar Pradesh', country: 'India' },
  { city: 'Greater Noida', state: 'Uttar Pradesh', country: 'India' },
  { city: 'Tirumala', state: 'Andhra Pradesh', country: 'India' },
  { city: 'Bhilai', state: 'Chhattisgarh', country: 'India' },
  { city: 'Jamshedpur', state: 'Jharkhand', country: 'India' },
  { city: 'Pune', state: 'Maharashtra', country: 'India' },
  { city: 'Bengaluru', state: 'Karnataka', country: 'India' },
  { city: 'Mysuru', state: 'Karnataka', country: 'India' },
  { city: 'Mangaluru', state: 'Karnataka', country: 'India' },
  { city: 'Hubballi', state: 'Karnataka', country: 'India' },
  { city: 'Belagavi', state: 'Karnataka', country: 'India' },
  { city: 'Kalaburagi', state: 'Karnataka', country: 'India' },
  { city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
  { city: 'Coimbatore', state: 'Tamil Nadu', country: 'India' },
  { city: 'Madurai', state: 'Tamil Nadu', country: 'India' },
  { city: 'Tiruchirappalli', state: 'Tamil Nadu', country: 'India' },
  { city: 'Tiruppur', state: 'Tamil Nadu', country: 'India' },
  { city: 'Tirunelveli', state: 'Tamil Nadu', country: 'India' },
  { city: 'Salem', state: 'Tamil Nadu', country: 'India' },
  { city: 'Erode', state: 'Tamil Nadu', country: 'India' },
  { city: 'Hyderabad', state: 'Telangana', country: 'India' },
  { city: 'Warangal', state: 'Telangana', country: 'India' },
  { city: 'Visakhapatnam', state: 'Andhra Pradesh', country: 'India' },
  { city: 'Vijayawada', state: 'Andhra Pradesh', country: 'India' },
  { city: 'Tirupati', state: 'Andhra Pradesh', country: 'India' },
  { city: 'Guntur', state: 'Andhra Pradesh', country: 'India' },
  { city: 'Kolkata', state: 'West Bengal', country: 'India' },
  { city: 'Howrah', state: 'West Bengal', country: 'India' },
  { city: 'Durgapur', state: 'West Bengal', country: 'India' },
  { city: 'Siliguri', state: 'West Bengal', country: 'India' },
  { city: 'Asansol', state: 'West Bengal', country: 'India' },
  { city: 'Kochi', state: 'Kerala', country: 'India' },
  { city: 'Thiruvananthapuram', state: 'Kerala', country: 'India' },
  { city: 'Surat', state: 'Gujarat', country: 'India' },
  { city: 'Vadodara', state: 'Gujarat', country: 'India' },
  { city: 'Rajkot', state: 'Gujarat', country: 'India' },
  { city: 'Bhavnagar', state: 'Gujarat', country: 'India' },
  { city: 'Jamnagar', state: 'Gujarat', country: 'India' },
  { city: 'Bhopal', state: 'Madhya Pradesh', country: 'India' },
  { city: 'Indore', state: 'Madhya Pradesh', country: 'India' },
  { city: 'Jabalpur', state: 'Madhya Pradesh', country: 'India' },
  { city: 'Gwalior', state: 'Madhya Pradesh', country: 'India' },
  { city: 'Ujjain', state: 'Madhya Pradesh', country: 'India' },
  { city: 'Jaipur', state: 'Rajasthan', country: 'India' },
  { city: 'Jodhpur', state: 'Rajasthan', country: 'India' },
  { city: 'Udaipur', state: 'Rajasthan', country: 'India' },
  { city: 'Kota', state: 'Rajasthan', country: 'India' },
  { city: 'Ajmer', state: 'Rajasthan', country: 'India' },
  { city: 'Bikaner', state: 'Rajasthan', country: 'India' },
  { city: 'Bhubaneswar', state: 'Odisha', country: 'India' },
  { city: 'Cuttack', state: 'Odisha', country: 'India' },
  { city: 'Patna', state: 'Bihar', country: 'India' },
  { city: 'Gaya', state: 'Bihar', country: 'India' },
  { city: 'Lucknow', state: 'Uttar Pradesh', country: 'India' },
  { city: 'Kanpur', state: 'Uttar Pradesh', country: 'India' },
  { city: 'Agra', state: 'Uttar Pradesh', country: 'India' },
  { city: 'Varanasi', state: 'Uttar Pradesh', country: 'India' },
  { city: 'Allahabad', state: 'Uttar Pradesh', country: 'India' }, // pre-rename
  { city: 'Chandigarh', state: 'Chandigarh', country: 'India' },
  { city: 'Ludhiana', state: 'Punjab', country: 'India' },
  { city: 'Amritsar', state: 'Punjab', country: 'India' },
  { city: 'Gurugram', state: 'Haryana', country: 'India' },
  { city: 'Faridabad', state: 'Haryana', country: 'India' },
  { city: 'Dehradun', state: 'Uttarakhand', country: 'India' },
  { city: 'Rishikesh', state: 'Uttarakhand', country: 'India' },
  { city: 'Haridwar', state: 'Uttarakhand', country: 'India' },
  { city: 'Guwahati', state: 'Assam', country: 'India' },
  { city: 'Shillong', state: 'Meghalaya', country: 'India' },
  { city: 'Imphal', state: 'Manipur', country: 'India' },
  { city: 'Aizawl', state: 'Mizoram', country: 'India' },
  { city: 'Kohima', state: 'Nagaland', country: 'India' },
  { city: 'Gangtok', state: 'Sikkim', country: 'India' },
  { city: 'Agartala', state: 'Tripura', country: 'India' },
  { city: 'Itanagar', state: 'Arunachal Pradesh', country: 'India' },
  { city: 'Panaji', state: 'Goa', country: 'India' },
  { city: 'Margao', state: 'Goa', country: 'India' },
  { city: 'Pondicherry', state: 'Puducherry', country: 'India' },
  { city: 'Port Blair', state: 'Andaman and Nicobar Islands', country: 'India' },
  { city: 'Leh', state: 'Ladakh', country: 'India' },
  { city: 'Vrindavan', state: 'Uttar Pradesh', country: 'India' },
];

// ---------------------------------------------------------------------------
// All districts of India, grouped by state.
// ---------------------------------------------------------------------------
const DISTRICTS_BY_STATE: Record<string, string[]> = {
  'Andhra Pradesh': [
    'Alluri Sitharama Raju', 'Anakapalli', 'Anantapur', 'Annamayya', 'Bapatla',
    'Chittoor', 'East Godavari', 'Eluru', 'Guntur', 'Kakinada', 'Konaseema',
    'Krishna', 'Kurnool', 'Nandyal', 'NTR', 'Palnadu', 'Parvathipuram Manyam',
    'Prakasam', 'Sri Potti Sriramulu Nellore', 'Sri Sathya Sai', 'Srikakulam',
    'Tirupati', 'Visakhapatnam', 'Vizianagaram', 'West Godavari', 'YSR Kadapa',
  ],
  'Arunachal Pradesh': [
    'Anjaw', 'Changlang', 'Dibang Valley', 'East Kameng', 'East Siang',
    'Kamle', 'Kra Daadi', 'Kurung Kumey', 'Lepa Rada', 'Lohit', 'Longding',
    'Lower Dibang Valley', 'Lower Siang', 'Lower Subansiri', 'Namsai',
    'Pakke-Kessang', 'Papum Pare', 'Shi Yomi', 'Siang', 'Tawang', 'Tirap',
    'Upper Siang', 'Upper Subansiri', 'West Kameng', 'West Siang',
  ],
  'Assam': [
    'Bajali', 'Baksa', 'Barpeta', 'Biswanath', 'Bongaigaon', 'Cachar',
    'Charaideo', 'Chirang', 'Darrang', 'Dhemaji', 'Dhubri', 'Dibrugarh',
    'Dima Hasao', 'Goalpara', 'Golaghat', 'Hailakandi', 'Hojai', 'Jorhat',
    'Kamrup', 'Kamrup Metropolitan', 'Karbi Anglong', 'Karimganj', 'Kokrajhar',
    'Lakhimpur', 'Majuli', 'Morigaon', 'Nagaon', 'Nalbari', 'Sivasagar',
    'Sonitpur', 'South Salmara-Mankachar', 'Tamulpur', 'Tinsukia', 'Udalguri',
    'West Karbi Anglong',
  ],
  'Bihar': [
    'Araria', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur',
    'Bhojpur', 'Buxar', 'Darbhanga', 'East Champaran', 'Gaya', 'Gopalganj',
    'Jamui', 'Jehanabad', 'Kaimur', 'Katihar', 'Khagaria', 'Kishanganj',
    'Lakhisarai', 'Madhepura', 'Madhubani', 'Munger', 'Muzaffarpur', 'Nalanda',
    'Nawada', 'Patna', 'Purnia', 'Rohtas', 'Saharsa', 'Samastipur', 'Saran',
    'Sheikhpura', 'Sheohar', 'Sitamarhi', 'Siwan', 'Supaul', 'Vaishali',
    'West Champaran',
  ],
  'Chhattisgarh': [
    'Balod', 'Baloda Bazar', 'Balrampur', 'Bastar', 'Bemetara', 'Bijapur',
    'Bilaspur', 'Dantewada', 'Dhamtari', 'Durg', 'Gariaband',
    'Gaurela-Pendra-Marwahi', 'Janjgir-Champa', 'Jashpur', 'Kabirdham',
    'Kanker', 'Khairagarh-Chhuikhadan-Gandai', 'Kondagaon', 'Korba', 'Koriya',
    'Mahasamund', 'Manendragarh-Chirmiri-Bharatpur',
    'Mohla-Manpur-Ambagarh Chowki', 'Mungeli', 'Narayanpur', 'Raigarh',
    'Raipur', 'Rajnandgaon', 'Sakti', 'Sarangarh-Bilaigarh', 'Sukma',
    'Surajpur', 'Surguja',
  ],
  'Goa': ['North Goa', 'South Goa'],
  'Gujarat': [
    'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch',
    'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang',
    'Devbhoomi Dwarka', 'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh',
    'Kheda', 'Kutch', 'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari',
    'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat',
    'Surendranagar', 'Tapi', 'Vadodara', 'Valsad',
  ],
  'Haryana': [
    'Ambala', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad', 'Gurugram',
    'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal', 'Kurukshetra',
    'Mahendragarh', 'Nuh', 'Palwal', 'Panchkula', 'Panipat', 'Rewari',
    'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar',
  ],
  'Himachal Pradesh': [
    'Bilaspur', 'Chamba', 'Hamirpur', 'Kangra', 'Kinnaur', 'Kullu',
    'Lahaul and Spiti', 'Mandi', 'Shimla', 'Sirmaur', 'Solan', 'Una',
  ],
  'Jharkhand': [
    'Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum',
    'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 'Khunti',
    'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 'Ramgarh', 'Ranchi',
    'Sahebganj', 'Seraikela Kharsawan', 'Simdega', 'West Singhbhum',
  ],
  'Karnataka': [
    'Bagalkot', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban',
    'Bidar', 'Chamarajanagar', 'Chikballapur', 'Chikkamagaluru', 'Chitradurga',
    'Dakshina Kannada', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Haveri',
    'Kalaburagi', 'Kodagu', 'Kolar', 'Koppal', 'Mandya', 'Mysuru', 'Raichur',
    'Ramanagara', 'Shivamogga', 'Tumakuru', 'Udupi', 'Uttara Kannada',
    'Vijayanagara', 'Vijayapura', 'Yadgir',
  ],
  'Kerala': [
    'Alappuzha', 'Ernakulam', 'Idukki', 'Kannur', 'Kasaragod', 'Kollam',
    'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta',
    'Thiruvananthapuram', 'Thrissur', 'Wayanad',
  ],
  'Madhya Pradesh': [
    'Agar Malwa', 'Alirajpur', 'Anuppur', 'Ashoknagar', 'Balaghat', 'Barwani',
    'Betul', 'Bhind', 'Bhopal', 'Burhanpur', 'Chhatarpur', 'Chhindwara',
    'Damoh', 'Datia', 'Dewas', 'Dhar', 'Dindori', 'Guna', 'Gwalior', 'Harda',
    'Hoshangabad', 'Indore', 'Jabalpur', 'Jhabua', 'Katni', 'Khandwa',
    'Khargone', 'Maihar', 'Mandla', 'Mandsaur', 'Mauganj', 'Morena',
    'Narsinghpur', 'Neemuch', 'Niwari', 'Pandhurna', 'Panna', 'Raisen',
    'Rajgarh', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Sehore', 'Seoni',
    'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri', 'Sidhi', 'Singrauli',
    'Tikamgarh', 'Ujjain', 'Umaria', 'Vidisha',
  ],
  'Maharashtra': [
    'Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Beed', 'Bhandara',
    'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli',
    'Jalgaon', 'Jalna', 'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban',
    'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar',
    'Parbhani', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara',
    'Sindhudurg', 'Solapur', 'Thane', 'Wardha', 'Washim', 'Yavatmal',
  ],
  'Manipur': [
    'Bishnupur', 'Chandel', 'Churachandpur', 'Imphal East', 'Imphal West',
    'Jiribam', 'Kakching', 'Kamjong', 'Kangpokpi', 'Noney', 'Pherzawl',
    'Senapati', 'Tamenglong', 'Tengnoupal', 'Thoubal', 'Ukhrul',
  ],
  'Meghalaya': [
    'East Garo Hills', 'East Jaintia Hills', 'East Khasi Hills',
    'Eastern West Khasi Hills', 'North Garo Hills', 'Ri Bhoi',
    'South Garo Hills', 'South West Garo Hills', 'South West Khasi Hills',
    'West Garo Hills', 'West Jaintia Hills', 'West Khasi Hills',
  ],
  'Mizoram': [
    'Aizawl', 'Champhai', 'Hnahthial', 'Khawzawl', 'Kolasib', 'Lawngtlai',
    'Lunglei', 'Mamit', 'Saiha', 'Saitual', 'Serchhip',
  ],
  'Nagaland': [
    'Chumukedima', 'Dimapur', 'Kiphire', 'Kohima', 'Longleng', 'Mokokchung',
    'Mon', 'Niuland', 'Noklak', 'Peren', 'Phek', 'Shamator', 'Tseminyu',
    'Tuensang', 'Wokha', 'Zunheboto',
  ],
  'Odisha': [
    'Angul', 'Balangir', 'Balasore', 'Bargarh', 'Bhadrak', 'Boudh', 'Cuttack',
    'Deogarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur',
    'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Kendujhar',
    'Khordha', 'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur',
    'Nayagarh', 'Nuapada', 'Puri', 'Rayagada', 'Sambalpur', 'Subarnapur',
    'Sundargarh',
  ],
  'Punjab': [
    'Amritsar', 'Barnala', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib',
    'Fazilka', 'Ferozepur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar',
    'Kapurthala', 'Ludhiana', 'Malerkotla', 'Mansa', 'Moga', 'Muktsar',
    'Pathankot', 'Patiala', 'Rupnagar', 'Sahibzada Ajit Singh Nagar',
    'Sangrur', 'Shaheed Bhagat Singh Nagar', 'Tarn Taran',
  ],
  'Rajasthan': [
    'Ajmer', 'Alwar', 'Anupgarh', 'Balotra', 'Banswara', 'Baran', 'Barmer',
    'Beawar', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Bundi', 'Chittorgarh',
    'Churu', 'Dausa', 'Deeg', 'Didwana-Kuchaman', 'Dholpur', 'Dudu',
    'Dungarpur', 'Gangapur City', 'Hanumangarh', 'Jaipur', 'Jaipur Rural',
    'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu', 'Jodhpur', 'Jodhpur Rural',
    'Karauli', 'Kekri', 'Khairthal-Tijara', 'Kota', 'Kotputli-Behror',
    'Nagaur', 'Neem Ka Thana', 'Pali', 'Phalodi', 'Pratapgarh', 'Rajsamand',
    'Salumbar', 'Sanchore', 'Sawai Madhopur', 'Shahpura', 'Sikar', 'Sirohi',
    'Sri Ganganagar', 'Tonk', 'Udaipur',
  ],
  'Sikkim': ['Gangtok', 'Gyalshing', 'Mangan', 'Namchi', 'Pakyong', 'Soreng'],
  'Tamil Nadu': [
    'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore',
    'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram',
    'Kanyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai',
    'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai',
    'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur',
    'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupathur',
    'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore',
    'Viluppuram', 'Virudhunagar',
  ],
  'Telangana': [
    'Adilabad', 'Bhadradri Kothagudem', 'Hanumakonda', 'Hyderabad', 'Jagtial',
    'Jangaon', 'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy',
    'Karimnagar', 'Khammam', 'Komaram Bheem', 'Mahabubabad', 'Mahabubnagar',
    'Mancherial', 'Medak', 'Medchal Malkajgiri', 'Mulugu', 'Nagarkurnool',
    'Nalgonda', 'Narayanpet', 'Nirmal', 'Nizamabad', 'Peddapalli',
    'Rajanna Sircilla', 'Rangareddy', 'Sangareddy', 'Siddipet', 'Suryapet',
    'Vikarabad', 'Wanaparthy', 'Warangal', 'Yadadri Bhuvanagiri',
  ],
  'Tripura': [
    'Dhalai', 'Gomati', 'Khowai', 'North Tripura', 'Sepahijala',
    'South Tripura', 'Unakoti', 'West Tripura',
  ],
  'Uttar Pradesh': [
    'Agra', 'Aligarh', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Auraiya',
    'Ayodhya', 'Azamgarh', 'Baghpat', 'Bahraich', 'Ballia', 'Balrampur',
    'Banda', 'Barabanki', 'Bareilly', 'Basti', 'Bhadohi', 'Bijnor', 'Budaun',
    'Bulandshahr', 'Chandauli', 'Chitrakoot', 'Deoria', 'Etah', 'Etawah',
    'Farrukhabad', 'Fatehpur', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad',
    'Ghazipur', 'Gonda', 'Gorakhpur', 'Hamirpur', 'Hapur', 'Hardoi', 'Hathras',
    'Jalaun', 'Jaunpur', 'Jhansi', 'Kannauj', 'Kanpur Dehat', 'Kanpur Nagar',
    'Kasganj', 'Kaushambi', 'Kushinagar', 'Lakhimpur Kheri', 'Lalitpur',
    'Lucknow', 'Maharajganj', 'Mahoba', 'Mainpuri', 'Mathura', 'Mau', 'Meerut',
    'Mirzapur', 'Moradabad', 'Muzaffarnagar', 'Pilibhit', 'Pratapgarh',
    'Prayagraj', 'Raebareli', 'Rampur', 'Saharanpur', 'Sambhal',
    'Sant Kabir Nagar', 'Shahjahanpur', 'Shamli', 'Shravasti',
    'Siddharthnagar', 'Sitapur', 'Sonbhadra', 'Sultanpur', 'Unnao', 'Varanasi',
  ],
  'Uttarakhand': [
    'Almora', 'Bageshwar', 'Chamoli', 'Champawat', 'Dehradun', 'Haridwar',
    'Nainital', 'Pauri Garhwal', 'Pithoragarh', 'Rudraprayag', 'Tehri Garhwal',
    'Udham Singh Nagar', 'Uttarkashi',
  ],
  'West Bengal': [
    'Alipurduar', 'Bankura', 'Birbhum', 'Cooch Behar', 'Dakshin Dinajpur',
    'Darjeeling', 'Hooghly', 'Howrah', 'Jalpaiguri', 'Jhargram', 'Kalimpong',
    'Kolkata', 'Malda', 'Murshidabad', 'Nadia', 'North 24 Parganas',
    'Paschim Bardhaman', 'Paschim Medinipur', 'Purba Bardhaman',
    'Purba Medinipur', 'Purulia', 'South 24 Parganas', 'Uttar Dinajpur',
  ],
  'Delhi': [
    'Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi',
    'North East Delhi', 'North West Delhi', 'Shahdara', 'South Delhi',
    'South East Delhi', 'South West Delhi', 'West Delhi',
  ],
  'Jammu and Kashmir': [
    'Anantnag', 'Bandipore', 'Baramulla', 'Budgam', 'Doda', 'Ganderbal',
    'Jammu', 'Kathua', 'Kishtwar', 'Kulgam', 'Kupwara', 'Poonch', 'Pulwama',
    'Rajouri', 'Ramban', 'Reasi', 'Samba', 'Shopian', 'Srinagar', 'Udhampur',
  ],
  'Ladakh': ['Kargil', 'Leh'],
  'Chandigarh': ['Chandigarh'],
  'Puducherry': ['Karaikal', 'Mahe', 'Puducherry', 'Yanam'],
  'Andaman and Nicobar Islands': [
    'Nicobar', 'North and Middle Andaman', 'South Andaman',
  ],
  'Dadra and Nagar Haveli and Daman and Diu': [
    'Dadra and Nagar Haveli', 'Daman', 'Diu',
  ],
  'Lakshadweep': ['Lakshadweep'],
};

// ---------------------------------------------------------------------------
// Aliases — common alternative names that should resolve to the canonical city.
// ---------------------------------------------------------------------------
const CITY_ALIASES: Record<string, string[]> = {
  Mumbai: ['Bombay'],
  Bengaluru: ['Bangalore'],
  Chennai: ['Madras'],
  Kolkata: ['Calcutta'],
  Visakhapatnam: ['Vizag', 'Vizagh', 'Vizak'],
  Mysuru: ['Mysore'],
  Mangaluru: ['Mangalore'],
  Hubballi: ['Hubli', 'Hubli-Dharwad'],
  Belagavi: ['Belgaum'],
  Vadodara: ['Baroda'],
  Kochi: ['Cochin'],
  Thiruvananthapuram: ['Trivandrum', 'TVM'],
  Pondicherry: ['Puducherry'],
  Puducherry: ['Pondicherry'],
  Prayagraj: ['Allahabad'],
  Gurugram: ['Gurgaon'],
  Kalaburagi: ['Gulbarga'],
  Ballari: ['Bellary'],
  Shivamogga: ['Shimoga'],
  Tumakuru: ['Tumkur'],
  Kozhikode: ['Calicut'],
  Thrissur: ['Trichur'],
  Tiruchirappalli: ['Trichy', 'Tiruchi'],
  Bharuch: ['Broach'],
  Vijayawada: ['Bezawada'],
  Hanumakonda: ['Hanamkonda', 'Warangal Urban'],
  Hazaribagh: ['Hazaribag'],
  Patna: ['Pataliputra'],
  Indore: ['Indur'],
  'Sri Ganganagar': ['Ganganagar'],
  Aurangabad: ['Sambhajinagar'],
  Osmanabad: ['Dharashiv'],
  Ahmednagar: ['Ahmadnagar'],
  Hyderabad: ['Hyd'],
  Bengaluru_Urban: ['Bangalore Urban', 'Bangalore'],
};

// ---------------------------------------------------------------------------
// Build the merged, deduped, sorted list of cities.
// ---------------------------------------------------------------------------
function buildCityList(): CityOption[] {
  const seen = new Set<string>();
  const out: CityOption[] = [];

  const push = (c: CityOption) => {
    const key = `${c.city.toLowerCase()}|${c.state.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };

  for (const [state, districts] of Object.entries(DISTRICTS_BY_STATE)) {
    for (const city of districts) push({ city, state, country: 'India' });
  }
  for (const c of EXTRA_CITIES) push(c);

  out.sort((a, b) => a.city.localeCompare(b.city));
  return out;
}

export const INDIAN_CITIES: CityOption[] = buildCityList();

/** Standard display label: "Bengaluru, Karnataka, India". */
export function formatCity(c: CityOption): string {
  return `${c.city}, ${c.state}, ${c.country}`;
}

/**
 * Case-insensitive search with three tiers (in this order):
 *   1. canonical city name "starts with" the query
 *   2. alias "starts with" the query (resolved to its canonical entry)
 *   3. city name or state "contains" the query
 */
export function searchCities(query: string, limit = 6): CityOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return INDIAN_CITIES.slice(0, limit);

  const starts: CityOption[] = [];
  const aliasHits: CityOption[] = [];
  const contains: CityOption[] = [];
  const seen = new Set<string>();

  const visit = (c: CityOption, bucket: CityOption[]) => {
    const key = `${c.city}|${c.state}`;
    if (seen.has(key)) return;
    seen.add(key);
    bucket.push(c);
  };

  // 1. starts-with on canonical name
  for (const c of INDIAN_CITIES) {
    if (c.city.toLowerCase().startsWith(q)) visit(c, starts);
    if (starts.length >= limit) break;
  }

  // 2. aliases — find canonical city, then locate its entry
  if (starts.length < limit) {
    for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
      for (const alias of aliases) {
        const al = alias.toLowerCase();
        if (al.startsWith(q) || al.includes(q)) {
          const found = INDIAN_CITIES.find((c) => c.city === canonical);
          if (found) visit(found, aliasHits);
          break;
        }
      }
      if (starts.length + aliasHits.length >= limit) break;
    }
  }

  // 3. contains on city / state
  if (starts.length + aliasHits.length < limit) {
    for (const c of INDIAN_CITIES) {
      if (
        c.city.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q)
      ) {
        visit(c, contains);
      }
      if (starts.length + aliasHits.length + contains.length >= limit) break;
    }
  }

  return [...starts, ...aliasHits, ...contains].slice(0, limit);
}
