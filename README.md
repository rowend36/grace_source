# Currently focused on testing and bug-fixing.
But if you have a really good UI suggestion, I'll accept.

# Fileservers
Grace hit a huge disappointment when Android decided to remove filesystem support.
Development was halted for almost 8 months as a result.
After a while, I decided it did not really matter.
The RESTFileServer works very well with Termux.
There is still an BrowserFileServer and and AndroidFileServer though.

# Scope
Grace targets are limited to  
1) Make long running ops microtasks, that way they can be scheduled or run in a different task
2) Make a variety of autocompletion tools. Not necessarily with a parser. Read code like a human. Is that even possible
3) Maximize use of screen space
4) Lint and beautify code where possible
5) Reduce memory footprint where possible.

# Outside Grace scope
1) Compilation
2) Running code
For those it assumes the user has a terminal. Use the terminal command.

# Gray Areas
1) Git support
2) File operations
3) File servers

# Grace Dependency Behaviour
- Really funny. Rather than using dependencies, I just wrote everything from
 scratch.

# _Define
Why _Define? Simple. It was initially a one man project. 
_Define allowed me to get the best of both worlds.
You know the function names. Why bother with where they are located
var Utils = global.Utils works all the time.
Splitting files is simple. Merging them is even easier.
It's like Java, actually.And while it's not suitable for big projects, it was perfect for a time.
Of course, that was until Object.keys(global).length became 156
Think of it like a really large index.js.

--------------
Later on, I have decided to switch to requirejs.
I tried switching to esmodules but it was too much work.
Requirejs gives enough control over dependencies at runtime.


# Es5
Grace is written in Es5 syntax. Because it is really old.
I started writing it in 2019 and I wasn't pleased enough to host it,
till midnight of 2023.

Due to the way dependencies are, some stuff wonpt work in a non-es6 browser.
- Prettier
- Git
- Language servers
- Java Error Provider
- BrowserFileServer

Prettier and language servers have alternatives so that's not an issue.
I also rarely used flex due to compatibility initially.
This explains some of the position:absolute you might find in the UI.
However, that has changed and now Grace won't render without it.


