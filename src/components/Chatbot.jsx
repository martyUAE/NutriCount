import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

export const Chatbot = ({ userProfile, bmi, apiKey }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // initial greeting when the chat opens for the first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const introText = bmi 
        ? `Hello! I'm your AI Health Coach. Based on your current BMI of ${bmi}, I can help you generate a personalized workout or diet plan. What would you like to focus on?`
        : `Hello! I'm your AI Health Coach. Once you've entered your details in the settings, I can generate personalized workout and diet plans for you. How can I help today?`;

      setMessages([{ sender: 'ai', text: introText }]);
    }
  }, [isOpen, messages.length, bmi]);

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const newMessages = [...messages, { sender: 'user', text: userInput }];
    setMessages(newMessages);
    setUserInput('');
    setIsLoading(true);

    const systemPrompt = `
      You are an expert AI Health Coach. Your ONLY purpose is to provide workout and diet plans.
      You MUST strictly refuse to answer any questions not related to fitness, workouts, diet, nutrition, or health.
      If the user asks about anything else (e.g., coding, history, opinions), you MUST politely decline by saying something like, "I'm sorry, but I can only assist with creating workout and diet plans."

      Here is the user's data for context. Use it to personalize your recommendations:
      - Age: ${userProfile.age || 'Not provided'}
      - Gender: ${userProfile.gender || 'Not provided'}
      - Height: ${userProfile.height || 'Not provided'} cm
      - Weight: ${userProfile.weight || 'Not provided'} kg
      - Calculated BMI: ${bmi || 'Not provided'}
      - Stated Goal: ${userProfile.goal || 'Not provided'} weight

      Based on this context and the conversation history, respond to the user's latest message.

      IMPORTANT: Do not use any Markdown formatting, especially no asterisks for bolding (like **word**), no hashes for headings (like # Title), and no dashes for lists.
    `;

    const conversationHistory = newMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));
    
    conversationHistory.pop(); 

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [ ...conversationHistory, { role: 'user', parts: [{ text: userInput }] } ],
          systemInstruction: { parts: [{ text: systemPrompt }] }
        }),
      });
      
      if (!response.ok) throw new Error('Network response was not ok.');
      
      const data = await response.json();
      const aiResponse = data.candidates[0].content.parts[0].text;

      setMessages(prev => [...prev, { sender: 'ai', text: aiResponse }]);

    } catch (error) {
      console.error("Chatbot API error:", error);
      setMessages(prev => [...prev, { sender: 'ai', text: "I'm having trouble connecting right now. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-5 w-96 h-[60vh] bg-white rounded-xl shadow-2xl flex flex-col border z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gray-50 border-b rounded-t-xl">
            <h3 className="font-bold text-lg text-gray-800">AI Health Coach</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-800">
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="px-4 py-2 rounded-2xl bg-gray-200 text-gray-800">
                  <div className="flex items-center space-x-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.4s]"></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t rounded-b-xl">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask for a plan..."
                className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button onClick={handleSendMessage} disabled={isLoading || !userInput.trim()} className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50">
                <Send size={20}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-5 right-5 w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-40"
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
      </button>
    </>
  );
};

export default Chatbot;