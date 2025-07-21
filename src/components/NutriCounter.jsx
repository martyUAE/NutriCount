import React, { useState, useMemo } from 'react';
import { CSVLink } from "react-csv";
import { Calculator, Settings, BarChart3, Apple, Zap, Target, TrendingUp, LogOut, Sparkles, X, Trash2, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Chatbot } from './Chatbot';
import { doc, getDoc, updateDoc, collection, addDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const defaultApiKey = process.env.REACT_APP_GEMINI_API_KEY;

// Food Edit Modal
const FoodEditModal = ({ food, onSave, onCancel, onDelete }) => {
  const [editedFood, setEditedFood] = useState(food);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedFood(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };
  
   const nutrientFields = [
    { name: 'calories', label: 'Calories (kcal)' },
    { name: 'protein', label: 'Protein (g)' },
    { name: 'carbohydrates', label: 'Carbs (g)' },
    { name: 'fat', label: 'Fat (g)' },
    { name: 'fiber', label: 'Fiber (g)' },
    { name: 'sugar', label: 'Sugar (g)' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 shadow-lg w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Edit: {food.food_name}</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {nutrientFields.map(field => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-700">{field.label}</label>
              <input
                type="number"
                name={field.name}
                value={editedFood[field.name]}
                onChange={handleChange}
                className="mt-1 w-full px-3 py-2 border rounded-lg"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center pt-4">
          <button
            onClick={() => onDelete(food.id)}
            className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
          >
            <Trash2 size={18} />
            <span>Delete</span>
          </button>
          <div className="space-x-2">
            <button onClick={onCancel} className="px-4 py-2 border rounded-lg">Cancel</button>
            <button onClick={() => onSave(editedFood)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const NutriCounter = () => {
  const { user,logout } = useAuth();
  const [activeSection, setActiveSection] = useState('Overview');
  const [foodInput, setFoodInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [nutritionResult, setNutritionResult] = useState(null);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState(defaultApiKey || '');
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  
  useEffect(() => {
    // Make sure we have a logged-in user before trying to fetch data
    if (!user) return;

    // 1. Fetch the main user document to get profile and goals
    const userDocRef = doc(db, "users", user.uid);
    const getProfileAndGoals = async () => {
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const userData = docSnap.data();
        setUserProfile(userData.profile || { age: '', gender: 'female', /* defaults */ });
        setGoals(userData.goals || { calories: 2200, /* defaults */ });
      } else {
        console.log("No such user document! This should not happen if signup is correct.");
      }
    };
    getProfileAndGoals();

    // 2. Set up a REAL-TIME listener for the food log
    const foodLogCollectionRef = collection(db, "users", user.uid, "foodlogs");
    const q = query(foodLogCollectionRef, orderBy("loggedAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setDailyLog(logs); // Update our React state whenever Firestore changes
    });
    
    // Cleanup the listener when the component unmounts or the user logs out
    return () => unsubscribe();

  }, [user]);

  // Nutritional Goals
  const [goals, setGoals] = useState({
    calories: 2200,
    protein: 120,
    carbs: 200,
    fat: 75,
  });

  // list of foods the user has logged. Starts empty.
  const [dailyLog, setDailyLog] = useState([]);

  //Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFood, setEditingFood] = useState(null);

  // BMI Goal Generator
  const [isGeneratingGoals, setIsGeneratingGoals] = useState(false);
  const [userProfile, setUserProfile] = useState({
    age: '',
    gender: 'female',
    height: '', // in cm
    weight: '', // in kg
    activityLevel: 'sedentary', // sedentary, light, moderate, active, very_active
    goal: 'maintain', // maintain, lose, gain
  });
  const [bmi, setBmi] = useState(null);

  const menuItems = [
    { name: 'Overview', icon: BarChart3 },
    { name: 'Calculator', icon: Calculator },
    { name: 'Settings', icon: Settings },
  ];

  const handleAddFoodToLog = async () => {
    if (!nutritionResult || !user) return;
    const foodLogCollectionRef = collection(db, "users", user.uid, "foodlogs");
    await addDoc(foodLogCollectionRef, {
      ...nutritionResult,
      loggedAt: serverTimestamp() // Use server's timestamp for consistency
    });
    setNutritionResult(null);
    setFoodInput('');
    setActiveSection('Overview');

    // Reset the calculator for the next entry & switch to overview
    setNutritionResult(null);
    setFoodInput('');
    setActiveSection('Overview');
  };

  const handleGoalChange = (e) => {
    const { name, value } = e.target;
    setGoals(prevGoals => {
      const newGoals = { 
      ...prevGoals,
      [name]: parseInt(value) || 0, // Update the specific goal
    };

    saveProfileAndGoals(userProfile, newGoals);
    return newGoals;
    });
  };

  const handleAnalyzeFood = async () => {
    if (!foodInput.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);
    setNutritionResult(null);
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analyze the nutrition content of: "${foodInput}". 

Please provide a detailed breakdown in the following JSON format only (no other text):
{
  "food_name": "name of the food",
  "portion_size": "portion size",
  "calories": number,
  "protein": number,
  "carbohydrates": number,
  "fat": number,
  "fiber": number,
  "sugar": number,
  "sodium": number,
  "vitamin_c": number,
  "calcium": number,
  "iron": number
}

All nutrients should be in grams except calories (kcal), sodium (mg), vitamin_c (mg), calcium (mg), and iron (mg). Provide realistic estimates based on standard nutrition databases.`
            }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const generatedText = data.candidates[0].content.parts[0].text;
      
      // Extract JSON from the response
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const nutritionData = JSON.parse(jsonMatch[0]);
        setNutritionResult(nutritionData);
      } else {
        throw new Error('Could not parse nutrition data from API response');
      }
      
    } catch (err) {
      console.error('API Error:', err);
      setError('Failed to analyze food. Please check your API key and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const nutrientTotals = useMemo(() => {
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    dailyLog.forEach(food => {
      totals.calories += food.calories || 0;
      totals.protein += food.protein || 0;
      totals.carbs += food.carbohydrates || 0;
      totals.fat += food.fat || 0;
    });
    return totals;
  }, [dailyLog]);

  const overviewStats = [
    { name: 'Calories', current: nutrientTotals.calories, target: goals.calories, unit: 'kcal', color: 'bg-blue-500' },
    { name: 'Protein', current: nutrientTotals.protein, target: goals.protein, unit: 'g', color: 'bg-green-500' },
    { name: 'Carbs', current: nutrientTotals.carbs, target: goals.carbs, unit: 'g', color: 'bg-orange-500' },
    { name: 'Fat', current: nutrientTotals.fat, target: goals.fat, unit: 'g', color: 'bg-purple-500' }
  ];

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setUserProfile(prevProfile => {
      const newProfile = { ...prevProfile, [name]: value };
      
      // Save the updated profile to Firestore
      saveProfileAndGoals(newProfile, goals);
  
    // Calculate BMI with height and weight
    const heightInMeters = name === 'height' ? value / 100 : userProfile.height / 100;
    const weight = name === 'weight' ? value : userProfile.weight;
    if (heightInMeters > 0 && weight > 0) {
      const calculatedBmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);
      setBmi(calculatedBmi);
    } else {
      setBmi(null);
    }

    return newProfile;
  });
  };

  const handleGenerateGoals = async () => {
    setIsGeneratingGoals(true);
    setError(null);

    const prompt = `
      Act as an expert nutritionist. Based on the following user data, calculate their daily nutritional needs.
      User Data:
      - Age: ${userProfile.age}
      - Gender: ${userProfile.gender}
      - Height: ${userProfile.height} cm
      - Weight: ${userProfile.weight} kg
      - Activity Level: ${userProfile.activityLevel} (options: sedentary, light, moderate, active, very_active)
      - Primary Goal: ${userProfile.goal} weight (options: maintain, lose, gain)

      Please provide a recommended daily intake for calories, protein (g), carbs (g), and fat (g).
      Return the response ONLY in the following strict JSON format. Do not include any other text, explanations, or markdown formatting.

      {
        "calories": number,
        "protein": number,
        "carbs": number,
        "fat": number
      }
    `;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
      const data = await response.json();
      const generatedText = data.candidates[0].content.parts[0].text;
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const newGoals = JSON.parse(jsonMatch[0]);
        // Update the goals state with the AI's recommendations
        const roundedGoals = {
          calories: Math.round(newGoals.calories),
          protein: Math.round(newGoals.protein),
          carbs: Math.round(newGoals.carbs),
          fat: Math.round(newGoals.fat)
        };

        setGoals(roundedGoals);  // Update the local state
        await saveProfileAndGoals(userProfile, roundedGoals); // Save the newly generated goals to Firestore

      } else {
        throw new Error('Could not parse goals from AI response');
      }
    } catch (err) {
      console.error('AI Goal Generation Error:', err);
      setError('Failed to generate goals. Please check your inputs and API key.');
    } finally {
      setIsGeneratingGoals(false);
    }
  };

  //Handler Functions for Editing and Deleting
  const handleOpenEditModal = (foodToEdit) => {
    setEditingFood(foodToEdit);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingFood(null);
  };

  const handleUpdateFood = async (updatedFood) => {
    if (!user) return;
    const foodDocRef = doc(db, "users", user.uid, "foodlogs", updatedFood.id);
    const { id, ...foodData } = updatedFood; // Firestore doesn't need the id field in the document
    await updateDoc(foodDocRef, foodData);
    handleCloseEditModal();
  };

  const handleDeleteFood = async (foodId) => {
    if (!user) return;
    if (window.confirm("Are you sure you want to delete this item?")) {
      const foodDocRef = doc(db, "users", user.uid, "foodlogs", foodId);
      await deleteDoc(foodDocRef);
      handleCloseEditModal();
    }
  };

  const saveProfileAndGoals = async (newProfile, newGoals) => {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    await updateDoc(userDocRef, {
      profile: newProfile,
      goals: newGoals
    });
  };

  const prepareDataForExport = () => {
      // Define the headers for CSV file
      const headers = [
        { label: "Category", key: "category" },
        { label: "Item", key: "item" },
        { label: "Value", key: "value" },
        { label: "Unit/Target", key: "unit" },
      ];
      
      let dataToExport = [];
      
      // Add User BMI
      dataToExport.push({ category: "User Profile", item: "BMI", value: bmi || 'N/A' });
      dataToExport.push({}); // Add a blank row for spacing
      
      // Add Daily Overview Stats
      dataToExport.push({ category: "Daily Totals", item: "Nutrient", value: "Consumed", unit: "Goal" });
      overviewStats.forEach(stat => {
        dataToExport.push({
          category: "Daily Totals",
          item: stat.name,
          value: Math.round(stat.current),
          unit: `${stat.target} ${stat.unit}`
        });
      });
      dataToExport.push({}); // Add a blank row for spacing
      
      // Add Recent Foods (Daily Log)
      dataToExport.push({ category: "Logged Foods", item: "Food Name", value: "Calories", unit: "Portion" });
      if (dailyLog.length > 0) {
        dailyLog.forEach(food => {
          dataToExport.push({
            category: "Logged Foods",
            item: food.food_name,
            value: food.calories,
            unit: food.portion_size,
          });
        });
      } else {
        dataToExport.push({ category: "Logged Foods", item: "No foods logged yet." });
      }

      // Set the prepared data and headers to state, ready for the download link
      setCsvHeaders(headers);
      setCsvData(dataToExport);
    };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Daily Overview</h1>
          {/* Export Button */}
          <CSVLink 
            data={csvData}
            headers={csvHeaders}
            filename={"nutricounter_overview.csv"}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            onClick={prepareDataForExport} // Prepare data right before download
          >
            <Download size={18} />
            <span>Export to CSV</span>
          </CSVLink>
      </div>

      {/* Nutritional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {overviewStats.map((nutrient, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-600">{nutrient.name}</h3>
              <div className={`w-3 h-3 rounded-full ${nutrient.color}`}></div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-gray-900">
                {Math.round(nutrient.current).toLocaleString()}
                <span className="text-sm font-normal text-gray-500 ml-1">{nutrient.unit}</span>
              </div>
              <div className="text-xs text-gray-500">of {nutrient.target.toLocaleString()} {nutrient.unit}</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className={`h-2 rounded-full ${nutrient.color}`}
                  style={{ width: `${Math.min((nutrient.current / nutrient.target) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Foods */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Recent Foods</h2>
          <TrendingUp className="w-5 h-5 text-gray-400" />
        </div>
        <div className="space-y-3">
          {dailyLog.length > 0 ? (
            dailyLog.map((food) => (
              // Each food item is now a clickable button
              <button 
                key={food.id} 
                onClick={() => handleOpenEditModal(food)}
                className="w-full text-left flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div>
                    <div className="font-medium text-gray-900">{food.food_name}</div>
                    <div className="text-sm text-gray-500">{food.portion_size}</div>
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-900">{food.calories} cal</div>
              </button>
            ))
          ) : (
            <p className="text-center text-gray-500 py-4">No foods logged yet. Use the calculator to add some!</p>
          )}
        </div>
      </div>
      {/* Conditionally render the Edit Modal */}
      {isEditModalOpen && (
        <FoodEditModal 
          food={editingFood} 
          onSave={handleUpdateFood} 
          onCancel={handleCloseEditModal} 
          onDelete={handleDeleteFood}
        />
      )}
    </div>
    
  );

  const renderCalculator = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Zap className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-900">Nutrition Calculator</h1>
      </div>

      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Describe your food and portion size
            </label>
            <div className="flex space-x-3">
              <input
                type="text"
                value={foodInput}
                onChange={(e) => setFoodInput(e.target.value)}
                placeholder="e.g., 1 whole grilled chicken breast, 2 slices of bread, 1 cup of rice..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 placeholder-gray-500"
                onKeyPress={(e) => e.key === 'Enter' && handleAnalyzeFood()}
              />
              <button
                onClick={handleAnalyzeFood}
                disabled={!foodInput.trim() || isAnalyzing}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center space-x-2"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4" />
                    <span>Calculate</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Our AI will analyze your food description and provide detailed nutrition information.
            </p>
          </div>

          {isAnalyzing && (
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-100">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-blue-800 font-medium">Processing with Gemini AI nutrition analysis...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 rounded-lg p-6 border border-red-100">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">!</span>
                </div>
                <span className="text-red-800 font-medium">{error}</span>
              </div>
            </div>
          )}

          {nutritionResult && (
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 mt-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Nutrition Analysis</h3>
                <button 
                  onClick={() => setNutritionResult(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-100">
                <h4 className="font-semibold text-green-900">{nutritionResult.food_name}</h4>
                <p className="text-sm text-green-700">Portion: {nutritionResult.portion_size}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="text-2xl font-bold text-blue-900">{nutritionResult.calories}</div>
                  <div className="text-sm text-blue-700">Calories (kcal)</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <div className="text-2xl font-bold text-green-900">{nutritionResult.protein}g</div>
                  <div className="text-sm text-green-700">Protein</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                  <div className="text-2xl font-bold text-orange-900">{nutritionResult.carbohydrates}g</div>
                  <div className="text-sm text-orange-700">Carbs</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                  <div className="text-2xl font-bold text-purple-900">{nutritionResult.fat}g</div>
                  <div className="text-sm text-purple-700">Fat</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                  <div className="text-2xl font-bold text-yellow-900">{nutritionResult.fiber}g</div>
                  <div className="text-sm text-yellow-700">Fiber</div>
                </div>
                <div className="bg-pink-50 p-4 rounded-lg border border-pink-100">
                  <div className="text-2xl font-bold text-pink-900">{nutritionResult.sugar}g</div>
                  <div className="text-sm text-pink-700">Sugar</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="text-2xl font-bold text-gray-900">{nutritionResult.sodium}mg</div>
                  <div className="text-sm text-gray-700">Sodium</div>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                  <div className="text-2xl font-bold text-indigo-900">{nutritionResult.vitamin_c}mg</div>
                  <div className="text-sm text-indigo-700">Vitamin C</div>
                </div>
                <div className="bg-teal-50 p-4 rounded-lg border border-teal-100">
                  <div className="text-2xl font-bold text-teal-900">{nutritionResult.calcium}mg</div>
                  <div className="text-sm text-teal-700">Calcium</div>
                </div>
              </div>

              <div className="mt-6 flex space-x-3">
                <button 
                  onClick={handleAddFoodToLog}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                  Add to Daily Log
                </button>
                <button 
                  onClick={() => { setFoodInput(''); setNutritionResult(null); }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Analyze Another
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-100">
              <div className="flex items-center space-x-3 mb-3">
                <Target className="w-6 h-6 text-green-600" />
                <h3 className="font-semibold text-green-900">Quick Tips</h3>
              </div>
              <ul className="space-y-2 text-sm text-green-800">
                <li>• Be specific about portion sizes</li>
                <li>• Include cooking methods (grilled, fried, etc.)</li>
                <li>• Mention brands for packaged foods</li>
                <li>• Describe ingredients in mixed dishes</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-6 border border-purple-100">
              <div className="flex items-center space-x-3 mb-3">
                <Apple className="w-6 h-6 text-purple-600" />
                <h3 className="font-semibold text-purple-900">Example Inputs</h3>
              </div>
              <ul className="space-y-2 text-sm text-purple-800">
                <li>• "1 medium banana with peel"</li>
                <li>• "150g grilled salmon fillet"</li>
                <li>• "2 scrambled eggs with butter"</li>
                <li>• "1 cup cooked quinoa"</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Settings</h1>

      <div className="space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">API Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">AI Provider</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                <option>Gemini (Google)</option>
                <option>Custom API</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Gemini API key"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Your API key is stored locally and never sent to our servers</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Nutrition Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Daily Calories</label>
              <input
                type="number"
                name="calories"
                value={goals.calories}
                onChange={handleGoalChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Protein (g)</label>
              <input
                type="number"
                name="protein"
                value={goals.protein}
                onChange={handleGoalChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Carbs (g)</label>
              <input
                type="number"
                name="carbs"
                value={goals.carbs}
                onChange={handleGoalChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fat (g)</label>
              <input
                type="number"
                name="fat"
                value={goals.fat}
                onChange={handleGoalChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Personalize Goals with AI</h2>
            {bmi && <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-md">Your BMI: {bmi}</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
              <input type="number" name="age" value={userProfile.age} onChange={handleProfileChange} className="w-full px-3 py-2 border rounded-lg"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Height (cm)</label>
              <input type="number" name="height" value={userProfile.height} onChange={handleProfileChange} className="w-full px-3 py-2 border rounded-lg"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Weight (kg)</label>
              <input type="number" name="weight" value={userProfile.weight} onChange={handleProfileChange} className="w-full px-3 py-2 border rounded-lg"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
              <select name="gender" value={userProfile.gender} onChange={handleProfileChange} className="w-full px-3 py-2 border rounded-lg">
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Activity Level</label>
              <select name="activityLevel" value={userProfile.activityLevel} onChange={handleProfileChange} className="w-full px-3 py-2 border rounded-lg">
                <option value="sedentary">Sedentary (little or no exercise)</option>
                <option value="light">Light (1-3 days/week)</option>
                <option value="moderate">Moderate (3-5 days/week)</option>
                <option value="active">Active (6-7 days/week)</option>
                <option value="very_active">Very Active (hard exercise every day)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Goal</label>
              <select name="goal" value={userProfile.goal} onChange={handleProfileChange} className="w-full px-3 py-2 border rounded-lg">
                <option value="lose">Lose Weight</option>
                <option value="maintain">Maintain Weight</option>
                <option value="gain">Gain Weight</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleGenerateGoals}
            disabled={isGeneratingGoals || !userProfile.age || !userProfile.height || !userProfile.weight}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium flex items-center justify-center space-x-2"
          >
            {isGeneratingGoals ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Generate My Goals</span>
              </>
            )}
          </button>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );

  const renderContent = () => { 
    return (
      <>
        {/* The main content switcher */}
        {activeSection === 'Overview' && renderOverview()}
        {activeSection === 'Calculator' && renderCalculator()}
        {activeSection === 'Settings' && renderSettings()}
        
        {/* Chatbot on Overview page */}
        {activeSection === 'Overview' && (
          <Chatbot 
            userProfile={userProfile} 
            bmi={bmi} 
            apiKey={apiKey} 
          />
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg border-r border-gray-200 relative">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Apple className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">NutriCounter</h1>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => setActiveSection(item.name)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeSection === item.name
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-6 left-4 right-4">
          <button
              onClick={logout}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default NutriCounter;