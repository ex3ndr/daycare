# Data transformation without standard library
# No json, os, re, or datetime modules — use builtins, string methods,
# list/dict comprehensions, and the typing module only.

# Parse a simple CSV string
csv_text = "name,age,city\nAlice,30,Portland\nBob,25,Seattle\nCarol,35,Boise"
lines = csv_text.strip().split("\n")
headers = lines[0].split(",")
rows = [dict(zip(headers, line.split(","))) for line in lines[1:]]
for row in rows:
    print(f"{row['name']} is {row['age']} from {row['city']}")

# Filter and transform
adults = [r for r in rows if int(r["age"]) >= 30]
names_upper = [r["name"].upper() for r in adults]
print(names_upper)

# Build a lookup dict
by_city: dict[str, list[str]] = {}
for row in rows:
    city = row["city"]
    if city not in by_city:
        by_city[city] = []
    by_city[city].append(row["name"])
print(by_city)

# String manipulation
text = "  Hello,  World!  This   has  extra   spaces.  "
cleaned = " ".join(text.split())
print(cleaned)
words = cleaned.split()
capitalized = " ".join(w.capitalize() for w in words)
print(capitalized)
