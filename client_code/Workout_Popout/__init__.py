from ._anvil_designer import Workout_PopoutTemplate
from anvil import *
import anvil.server
import anvil.tables as tables
import anvil.tables.query as q
from anvil.tables import app_tables


class Workout_Popout(Workout_PopoutTemplate):
  def __init__(self, **properties):
    # Set Form properties and Data Bindings.
    self.init_components(**properties)

    global max
    global percent
    
    percent = self.item['percent']
    barWeight = get_open_form().barWeight_text_box.text
    platesAvailable = get_open_form().set_platesAvailable()
    max = self.find_max()
    
    
    if self.item['demo'] != None:
      self.image_1.source = self.item['demo']
    
    if percent != None:
      self.output_card.visible = True
      output, weight = self.find_plates(int(max), int(percent), int(barWeight), platesAvailable)
      self.pre_output.text = output[0]
      self.plates.text = '\n'.join(output[1:])
      self.weight.text = str(weight) + " lbs | "
      self.weight.visible = True
  

  def find_max(self, **event_args):
    global max
    
    if percent == None:
      self.output_card.visible = False
      #self.pre_output.text = "Challenge yourself... Focus on form over weight."
    else:
      if self.item['bench']:
        max = get_open_form().max_bench.text
      elif self.item['squat']:
        max = get_open_form().max_squat.text
      elif self.item['deadlift']:
        max = get_open_form().max_deadlift.text
    return max
    

  def find_plates(self, max, percent, barWeight, platesAvailable, **event_args):
    weight = int(max * (percent/100))

    plates = []
    nweights = []
    string = []
    remaining = weight - barWeight

    for  i, plate in enumerate(platesAvailable):
            if int(remaining / plate) % 2 == 0:
                    nweights.append(int(remaining/ plate))
            else:
                    nweights.append(int(remaining/ plate) - 1)
            remaining = remaining - nweights[i]*platesAvailable[i]
            if remaining == 0:
                    break

    plates=zip(nweights, platesAvailable)
    string.append(f'Plates required to reach {weight-remaining} lbs: ')

    for plate in plates:
            if plate[0] >= 2:
                    string.append(f"{int(plate[0]/2)} | {plate[1]} lb plate(s)")

    return string, weight-remaining

    




