// Java Test File
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

// Using: List, ArrayList, HashMap
// Unused: Map, Optional

public class Test {
    private List<String> items;

    public Test() {
        this.items = new ArrayList<>();
    }

    public void addItem(String item) {
        items.add(item);
    }

    public int getSize() {
        return items.size();
    }
}
