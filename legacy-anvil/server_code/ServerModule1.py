import anvil.email
import anvil.tables as tables
import anvil.tables.query as q
from anvil.tables import app_tables
import anvil.server

@anvil.server.callable
def send_feedback(name, date, body, attachments, email, happy):
  anvil.email.send(from_name="Squottober: User Feedback",
                  to="ottoa98@yahoo.com",
                  subject=f"Customer Feedback from {name}: {date.strftime('%A %d %b %Y at %I:%M %p')}",
                  text=f"{happy}\n\n{body}\n\n",
                  attachments=attachments)

@anvil.server.callable
def generate_workout(focus, experience, duration, type):
  import openai
  # Set up your openai API key
  openai.api_key = ""
  
  # Use the GPT-3 model to generate a new workout routine based on the user's inputs
  model = openai.Completion.create(
      engine="text-davinci-002",
      prompt=f"""Create a {type} routine for for {experience} level gym-goers. The duration of this routine should be {duration}. The routine should focus on {focus} muscle group. 
      Display the routine as a lift with a space between paragraphs.\n Follow the following format for the output: 1. #workout name | #sets and reps: #how to perform the workout \n 
      2. #workout name | #sets and reps: #how to perform the workout \n Example: 1. Barbell Bench Press | 3 sets of 6 reps: Lie with your back flat to the bench, Grip the barbell with 
      your hands a little further than shoulder width apart, Retract your shoulder blades, Lift the bar off the rack, bring it to sternum level so your arms are perfectly vertical.\n\n 
      2. Military Press | 4 sets of 10: Sit up with a straight back, Feet are on the ground. Hold dumbbells sideways on shoulder level. Press DB upwards and extend elbows. Slowly lower DB 
      towards the shoulders.\n For yoga and cardio workouts, the format should just be: 1: #Workout name: #duration and repitions if applicable | #description of workout""",
      max_tokens=1024,
      n = 1,
      stop = None,
      temperature = 0.5
  )
    
  # Print the generated workout routine
  return model.choices[0].text