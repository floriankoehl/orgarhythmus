from api.models import Attempt


def run():
    print("This works!")
    for attempt in Attempt.objects.all():
        print(attempt)