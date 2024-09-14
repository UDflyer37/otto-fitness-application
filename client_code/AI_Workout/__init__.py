from ._anvil_designer import AI_WorkoutTemplate
from anvil import *
import anvil.server
import anvil.tables as tables
import anvil.tables.query as q
from anvil.tables import app_tables


class AI_Workout(AI_WorkoutTemplate):
  def __init__(self, **properties):
    # Set Form properties and Data Bindings.
    self.init_components(**properties) 

    self.focus.items = ["Full-Body","Upperbody", "Lowerbody", "Chest", "Arms", "Legs", "Back", "Shoulders", "Abdominal"]
    self.experience.items = ["Beginner", "Intermediate", "Experienced"]
    self.duration.items = ["Long (an hour or more)","Short (less than an hour)"]
    self.type.items = ["Weight Lifting", "Cardio", "Bodyweight", "Stretching", "Yoga"]

  def run_button_click(self, **event_args):
    """This method is called when the button is clicked"""
    # Define the user's inputs
    experience = self.experience.selected_value
    duration = self.duration.selected_value
    type = self.type.selected_value
    if self.type.selected_value in ["Cardio", "Yoga"]:
      focus = "Whole Body"
    else:
      focus = self.focus.selected_value

    if experience == None:
      experience = "Intemediate"
    if duration == None:
      duration = "Normal"
    if type == None:
      type = "Full"
    if focus == None:
      focus = "Full-body"
      
    # Print the generated workout routine
    self.label_1.text = anvil.server.call('generate_workout', focus, experience, duration, type)

    #Set the title depending on user input.
    if self.type.selected_value in ["Cardio", "Yoga",None]:
      self.title.text = f"This is a {duration.lower()} {type.lower()} workout for {experience.lower()} level individuals:"
    else:
      self.title.text = f"This is a {duration.lower()} {type.lower()} workout for {experience.lower()} level individuals designed to focus on {focus.lower()}:"

    
    self.output_card.visible = True
    self.prompt_card.visible = False


  def return_button_click(self, **event_args):
    """This method is called when the button is clicked"""
    self.output_card.visible = False
    self.prompt_card.visible = True

  def try_again_button_click(self, **event_args):
    """This method is called when the button is clicked"""
    self.run_button_click()

  def type_change(self, **event_args):
    """This method is called when an item is selected"""
    if self.type.selected_value in ["Cardio", "Yoga"]:
      self.focus_box.visible = False
    else:
      self.focus_box.visible = True
    
    





